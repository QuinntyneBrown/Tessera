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
/// caches the current init segment for late joiners, and stops after the grace period.
/// </summary>
public sealed class LiveStreamSession(
    string streamId,
    IFragmentSource source,
    TimeProvider time,
    StreamSessionOptions options,
    ILogger logger,
    Action<LiveStreamSession> ended)
{
    private readonly Lock gate = new();
    private readonly List<StreamSubscriber> subscribers = [];
    private readonly CancellationTokenSource stopping = new();
    private Task? run;
    private ITimer? idleTimer;

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
            run ??= Task.Run(RunAsync);
            return true;
        }
    }

    public void Detach(StreamSubscriber subscriber)
    {
        lock (gate)
        {
            if (!subscribers.Remove(subscriber)) return;
            subscriber.Complete();
            if (subscribers.Count == 0 && State != SessionState.Stopped)
                idleTimer = time.CreateTimer(_ => End(null, onlyIfIdle: true), null,
                    TimeSpan.FromSeconds(options.IdleStopSeconds), Timeout.InfiniteTimeSpan);
        }
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
        try
        {
            await foreach (var fragmentEvent in source.ReadAsync(ct).WithCancellation(ct))
                Publish(fragmentEvent);
            logger.LogInformation("Stream {StreamId} reached the end of its source.", streamId);
            End(null);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
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
        }
        stopping.Cancel();
        ended(this);
    }
}
