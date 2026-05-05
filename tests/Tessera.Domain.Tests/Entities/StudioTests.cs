using Tessera.Domain.Entities;
using Xunit;

namespace Tessera.Domain.Tests.Entities;

public class StudioTests
{
    [Fact]
    public void Create_ShouldSetPropertiesCorrectly()
    {
        var studio = Studio.Create(Guid.NewGuid(), "Downtown Studio", "123 Main St", "Austin");

        Assert.Equal("Downtown Studio", studio.Name);
        Assert.Equal("Austin", studio.City);
        Assert.True(studio.IsActive);
    }

    [Fact]
    public void Studio_ShouldHaveEmptyYogaClassesCollectionByDefault()
    {
        var studio = Studio.Create(Guid.NewGuid(), "Test Studio", "1 Test Ln", "Dallas");
        Assert.NotNull(studio.YogaClasses);
        Assert.Empty(studio.YogaClasses);
    }
}
