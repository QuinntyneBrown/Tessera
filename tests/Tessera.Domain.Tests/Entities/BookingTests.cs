using Tessera.Domain.Entities;
using Xunit;

namespace Tessera.Domain.Tests.Entities;

public class BookingTests
{
    [Fact]
    public void Create_ShouldDefaultToPendingStatus()
    {
        var booking = Booking.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        Assert.Equal(BookingStatus.Pending, booking.Status);
    }

    [Fact]
    public void Confirm_ShouldSetStatusToConfirmed()
    {
        var booking = Booking.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        booking.Confirm();
        Assert.Equal(BookingStatus.Confirmed, booking.Status);
    }

    [Fact]
    public void Cancel_ShouldSetStatusToCancelled()
    {
        var booking = Booking.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        booking.Cancel();
        Assert.Equal(BookingStatus.Cancelled, booking.Status);
    }
}
