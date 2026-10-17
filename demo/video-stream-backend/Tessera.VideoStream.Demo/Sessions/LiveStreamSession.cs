using Microsoft.AspNetCore.SignalR;
using Tessera.VideoStream.Demo.Streaming;

namespace Tessera.VideoStream.Demo.Sessions;

public enum SessionState { Starting, Live, Restarting, Stopped }

public sealed class StreamSessionOptions
{
    /// <summary>The grace period after the last subscriber leaves, from <c>IdleStopSeconds</c>.</summary>
    public int IdleStopSeconds { get; set; } = 10;
}

/// <summary>
/// One running source shared by every subscriber of one stream: it starts on the first subscriber,
/// caches the current init segment for late joiners, restarts a failed source within a budget, and
/// stops after the grace period.
/// </summary>
public sealed class LiveStreamSession(
    string streamId,
    IFragmentSource source,
    TimeProvider time,
    StreamSessionOptions options,
    ILogger logger,
    Action<LiveStreamSession> ended)
{
    private static readonly TimeSpan SweepInterval = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan SlowConsumerLimit = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan RestartDelay = TimeSpan.FromSeconds(2);
    private static readonly TimeSpan RestartWindow = TimeSpan.FromSeconds(60);
    private const int RestartLimit = 3;

    private readonly Lock gate = new();
    private readonly List<StreamSubscriber> subscribers = [];
    private readonly CancellationTokenSource stopping = new();
    private Task? run;
    private ITimer? idleTimer;
    private ITimer? sweepTimer;
    private readonly Queue<DateTimeOffset> restarts = new();

    public string StreamId => streamId;

    public DateTimeOffset StartedAt { get; } = time.GetUtcNow();

    public SessionState State { get; private set; } = SessionState.Starting;

    public byte[]? CurrentInit { get; private set; }

    public int SubscriberCount
    {
        get { lock (gate) return subscribers.Count; }
    }

    /// <summary>Adds a subscriber, starting the source for the first; false once the session has stopped.</summary>
    public bool TryAttach(StreamSubscriber subscriber)
    {
        lock (gate)
        {
            if (State == SessionState.Stopped) return false;
            idleTimer?.Dispose();
            idleTimer = null;
            subscribers.Add(subscriber);
            if (CurrentInit is not null) subscriber.SendInit(CurrentInit);
            sweepTimer ??= time.CreateTimer(_ => Sweep(), null, SweepInterval, SweepInterval);
            run ??= Task.Run(RunAsync);
            return true;
        }
    }

    public void Detach(StreamSubscriber subscriber)
    {
        lock (gate) Remove(subscriber, null);
    }

    /// <summary>Stops the source and completes every subscriber, as at application shutdown.</summary>
    public async Task StopAsync()
    {
        End(null);
        if (run is not null) await run;
    }

    private async Task RunAsync()
    {
        var ct = stopping.Token;
        while (true)
        {
            try
            {
                await foreach (var fragmentEvent in source.ReadAsync(ct).WithCancellation(ct))
                    Publish(fragmentEvent);
                logger.LogInformation("Stream {StreamId} reached the end of its source.", streamId);
                End(null);
                return;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return;
            }
            catch (Exception error)
            {
                var reason = error is SourceFailedException ? error.Message : "ffmpeg output was unreadable";
                logger.LogError(error, "Stream {StreamId} source failed: {Reason}.", streamId, reason);
                if (!TryRecordRestart(error))
                {
                    End(new HubException($"source-failed: {reason}"));
                    return;
                }
                try
                {
                    await Task.Delay(RestartDelay, time, ct);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    /// <summary>Allows a restart while someone is watching, at most 3 in any 60 s, unless starting cannot succeed.</summary>
    private bool TryRecordRestart(Exception error)
    {
        if (error is SourceFailedException { Retryable: false }) return false;
        lock (gate)
        {
            if (State == SessionState.Stopped || subscribers.Count == 0) return false;
            var now = time.GetUtcNow();
            while (restarts.Count > 0 && now - restarts.Peek() >= RestartWindow) restarts.Dequeue();
            if (restarts.Count >= RestartLimit) return false;
            restarts.Enqueue(now);
            State = SessionState.Restarting;
            return true;
        }
    }

    private void Publish(FragmentEvent fragmentEvent)
    {
        lock (gate)
        {
            if (State == SessionState.Stopped) return;
            var data = fragmentEvent.Bytes.ToArray();
            if (fragmentEvent is InitSegment)
            {
                CurrentInit = data;
                State = SessionState.Live;
                foreach (var subscriber in subscribers) subscriber.SendInit(data);
            }
            else
            {
                foreach (var subscriber in subscribers) subscriber.SendMedia(data);
            }
        }
    }

    /// <summary>Evicts every subscriber that has stopped draining, so it cannot hold its slot forever.</summary>
    private void Sweep()
    {
        lock (gate)
        {
            foreach (var subscriber in subscribers.Where(s => s.IsStalled(SlowConsumerLimit)).ToList())
            {
                logger.LogWarning("Stream {StreamId} evicted connection {ConnectionId} as a slow consumer.",
                    streamId, subscriber.ConnectionId);
                Remove(subscriber, new HubException("slow-consumer"));
            }
        }
    }

    /// <summary>Under the lock: ends one subscriber's stream and starts the grace period after the last.</summary>
    private void Remove(StreamSubscriber subscriber, Exception? error)
    {
        if (!subscribers.Remove(subscriber)) return;
        if (error is null) subscriber.Complete();
        else subscriber.Fail(error);
        if (subscribers.Count == 0 && State != SessionState.Stopped)
            idleTimer = time.CreateTimer(_ => End(null, onlyIfIdle: true), null,
                TimeSpan.FromSeconds(options.IdleStopSeconds), Timeout.InfiniteTimeSpan);
    }

    /// <summary>Moves to Stopped once: completes every subscriber, cancels the source, and reports the end.</summary>
    private void End(Exception? error, bool onlyIfIdle = false)
    {
        lock (gate)
        {
            if (State == SessionState.Stopped || (onlyIfIdle && subscribers.Count > 0)) return;
            State = SessionState.Stopped;
            CurrentInit = null;
            foreach (var subscriber in subscribers) subscriber.Complete(error);
            subscribers.Clear();
            idleTimer?.Dispose();
            sweepTimer?.Dispose();
        }
        stopping.Cancel();
        ended(this);
    }
}
