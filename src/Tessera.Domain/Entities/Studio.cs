using Tessera.Domain.Common;

namespace Tessera.Domain.Entities;

public class Studio : BaseEntity, ITenantEntity
{
    private Studio() { }

    public Guid TenantId { get; private set; }
    public Tenant Tenant { get; private set; } = default!;

    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public string Address { get; private set; } = default!;
    public string City { get; private set; } = default!;
    public string? PhoneNumber { get; private set; }
    public string? Email { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<YogaClass> YogaClasses { get; private set; } = [];

    public static Studio Create(Guid tenantId, string name, string address, string city)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ArgumentException.ThrowIfNullOrWhiteSpace(address);
        ArgumentException.ThrowIfNullOrWhiteSpace(city);

        return new Studio
        {
            TenantId = tenantId,
            Name = name,
            Address = address,
            City = city
        };
    }

    public void Update(string name, string? description, string address, string city, string? phoneNumber, string? email)
    {
        Name = name;
        Description = description;
        Address = address;
        City = city;
        PhoneNumber = phoneNumber;
        Email = email;
        SetUpdatedAt();
    }

    public void Deactivate()
    {
        IsActive = false;
        SetUpdatedAt();
    }
}
