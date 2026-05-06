using Tessera.Domain.Entities;
using Xunit;

namespace Tessera.Domain.Tests.Entities;

public class YogaClassTests
{
    [Fact]
    public void Create_ShouldSetPropertiesCorrectly()
    {
        var yogaClass = YogaClass.Create(
            tenantId: Guid.NewGuid(),
            studioId: Guid.NewGuid(),
            name: "Morning Flow",
            style: YogaStyle.Hatha,
            durationMinutes: 60,
            maxCapacity: 20,
            pricePerSession: 25.00m);

        Assert.Equal("Morning Flow", yogaClass.Name);
        Assert.Equal(60, yogaClass.DurationMinutes);
        Assert.Equal(20, yogaClass.MaxCapacity);
        Assert.True(yogaClass.IsActive);
    }

    [Fact]
    public void Create_ShouldHaveEmptySessionsCollection()
    {
        var yogaClass = YogaClass.Create(Guid.NewGuid(), Guid.NewGuid(), "Flow", YogaStyle.Vinyasa, 45, 15, 20m);
        Assert.NotNull(yogaClass.Sessions);
        Assert.Empty(yogaClass.Sessions);
    }

    [Fact]
    public void Create_ShouldThrow_WhenDurationIsZero()
    {
        Assert.Throws<ArgumentException>(() =>
            YogaClass.Create(Guid.NewGuid(), Guid.NewGuid(), "Flow", YogaStyle.Vinyasa, 0, 15, 20m));
    }
}
