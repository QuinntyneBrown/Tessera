using Tessera.Domain.Common;
using Tessera.Domain.Events;

namespace Tessera.Domain.Entities;

public enum SessionStatus
{
    Scheduled,
    InProgress,
    Completed,
    Cancelled
}

public class ClassSession : BaseEntity, ITenantEntity
{
    private ClassSession() { }

    public Guid TenantId { get; private set; }
    public Guid YogaClassId { get; private set; }
    public YogaClass YogaClass { get; private set; } = default!;

    public Guid InstructorId { get; private set; }
    public Instructor Instructor { get; private set; } = default!;

    public DateTime ScheduledAt { get; private set; }
    public SessionStatus Status { get; private set; } = SessionStatus.Scheduled;
    public string? Notes { get; private set; }

    public ICollection<Booking> Bookings { get; private set; } = [];

    public int BookedCount => Bookings.Count(b => b.Status != BookingStatus.Cancelled);

    public static ClassSession Create(Guid tenantId, Guid yogaClassId, Guid instructorId, DateTime scheduledAt)
    {
        if (scheduledAt <= DateTime.UtcNow) throw new ArgumentException("Session must be scheduled in the future.", nameof(scheduledAt));

        return new ClassSession
        {
            TenantId = tenantId,
            YogaClassId = yogaClassId,
            InstructorId = instructorId,
            ScheduledAt = scheduledAt
        };
    }

    public void Cancel(string? reason = null)
    {
        Status = SessionStatus.Cancelled;
        Notes = reason;
        SetUpdatedAt();
        AddDomainEvent(new ClassSessionCancelledEvent(Id, TenantId));
    }

    public void Complete()
    {
        Status = SessionStatus.Completed;
        SetUpdatedAt();
    }
}
