using Tessera.Domain.Common;

namespace Tessera.Domain.Entities;

public enum YogaStyle
{
    Hatha,
    Vinyasa,
    Ashtanga,
    Yin,
    Restorative,
    Kundalini,
    Bikram,
    Iyengar,
    Power,
    Aerial
}

public class YogaClass : BaseEntity, ITenantEntity
{
    private YogaClass() { }

    public Guid TenantId { get; private set; }
    public Guid StudioId { get; private set; }
    public Studio Studio { get; private set; } = default!;

    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public YogaStyle Style { get; private set; }
    public int DurationMinutes { get; private set; }
    public int MaxCapacity { get; private set; }
    public decimal PricePerSession { get; private set; }
    public bool IsActive { get; private set; } = true;

    public ICollection<ClassSession> Sessions { get; private set; } = [];

    public static YogaClass Create(Guid tenantId, Guid studioId, string name, YogaStyle style,
        int durationMinutes, int maxCapacity, decimal pricePerSession)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        if (durationMinutes <= 0) throw new ArgumentException("Duration must be positive.", nameof(durationMinutes));
        if (maxCapacity <= 0) throw new ArgumentException("Capacity must be positive.", nameof(maxCapacity));
        if (pricePerSession < 0) throw new ArgumentException("Price cannot be negative.", nameof(pricePerSession));

        return new YogaClass
        {
            TenantId = tenantId,
            StudioId = studioId,
            Name = name,
            Style = style,
            DurationMinutes = durationMinutes,
            MaxCapacity = maxCapacity,
            PricePerSession = pricePerSession
        };
    }

    public void Update(string name, string? description, YogaStyle style,
        int durationMinutes, int maxCapacity, decimal pricePerSession)
    {
        Name = name;
        Description = description;
        Style = style;
        DurationMinutes = durationMinutes;
        MaxCapacity = maxCapacity;
        PricePerSession = pricePerSession;
        SetUpdatedAt();
    }
}
