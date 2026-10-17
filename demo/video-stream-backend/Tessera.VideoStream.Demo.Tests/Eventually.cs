namespace Tessera.VideoStream.Demo.Tests;

internal static class Eventually
{
    /// <summary>Polls a condition that background work makes true, failing after five seconds.</summary>
    public static async Task True(Func<bool> condition, string because)
    {
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (!condition())
        {
            if (DateTime.UtcNow > deadline) Assert.Fail($"Timed out waiting until {because}.");
            await Task.Delay(10, TestContext.Current.CancellationToken);
        }
    }
}
