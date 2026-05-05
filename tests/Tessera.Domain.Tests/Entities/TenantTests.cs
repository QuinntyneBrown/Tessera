using Tessera.Domain.Entities;
using Xunit;

namespace Tessera.Domain.Tests.Entities;

public class TenantTests
{
    [Fact]
    public void Create_ShouldSetPropertiesCorrectly()
    {
        var tenant = Tenant.Create("Sunrise Yoga", "sunrise-yoga");

        Assert.Equal("Sunrise Yoga", tenant.Name);
        Assert.Equal("sunrise-yoga", tenant.Slug);
        Assert.True(tenant.IsActive);
    }

    [Fact]
    public void Tenant_ShouldHaveEmptyStudiosCollectionByDefault()
    {
        var tenant = Tenant.Create("Test Tenant", "test-tenant");
        Assert.NotNull(tenant.Studios);
        Assert.Empty(tenant.Studios);
    }
}
