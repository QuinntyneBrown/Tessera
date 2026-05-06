using Tessera.Domain.Common;
using Tessera.Domain.Events;

namespace Tessera.Domain.Entities;

public class Tenant : BaseEntity
{
    private Tenant() { }

    public string Name { get; private set; } = default!;
    public string Slug { get; private set; } = default!;
    public string? LogoUrl { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<Studio> Studios { get; private set; } = [];

    public static Tenant Create(string name, string slug)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(slug);

        var tenant = new Tenant
        {
            Name = name,
            Slug = slug.ToLowerInvariant()
        };
        tenant.AddDomainEvent(new TenantCreatedEvent(tenant.Id));
        return tenant;
    }

    public void Update(string name, string? logoUrl)
    {
        Name = name;
        LogoUrl = logoUrl;
        SetUpdatedAt();
    }

    public void Deactivate()
    {
        IsActive = false;
        SetUpdatedAt();
    }
}
