using Tessera.Domain.Common;
using Tessera.Domain.Events;

namespace Tessera.Domain.Entities;

public enum BookingStatus
{
    Pending,
    Confirmed,
    Cancelled,
    Attended,
    NoShow
}

public class Booking : BaseEntity, ITenantEntity
{
    private Booking() { }

    public Guid TenantId { get; private set; }
    public Guid ClassSessionId { get; private set; }
    public ClassSession ClassSession { get; private set; } = default!;

    public Guid ParticipantId { get; private set; }
    public Participant Participant { get; private set; } = default!;

    public BookingStatus Status { get; private set; } = BookingStatus.Pending;
    public decimal AmountPaid { get; private set; }

    public Payment? Payment { get; private set; }

    public static Booking Create(Guid tenantId, Guid classSessionId, Guid participantId)
    {
        return new Booking
        {
            TenantId = tenantId,
            ClassSessionId = classSessionId,
            ParticipantId = participantId
        };
    }

    public void Confirm()
    {
        Status = BookingStatus.Confirmed;
        SetUpdatedAt();
        AddDomainEvent(new BookingConfirmedEvent(Id, TenantId, ParticipantId));
    }

    public void Cancel()
    {
        Status = BookingStatus.Cancelled;
        SetUpdatedAt();
    }

    public void MarkAttended()
    {
        Status = BookingStatus.Attended;
        SetUpdatedAt();
    }

    public void RecordPayment(decimal amount)
    {
        AmountPaid = amount;
        SetUpdatedAt();
    }
}
