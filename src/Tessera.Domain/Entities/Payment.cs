using Tessera.Domain.Common;
using Tessera.Domain.Events;

namespace Tessera.Domain.Entities;

public enum PaymentStatus
{
    Pending,
    Succeeded,
    Failed,
    Refunded
}

public enum PaymentMethod
{
    CreditCard,
    DebitCard,
    BankTransfer,
    Cash,
    Other
}

public class Payment : BaseEntity, ITenantEntity
{
    private Payment() { }

    public Guid TenantId { get; private set; }
    public Guid BookingId { get; private set; }
    public Booking Booking { get; private set; } = default!;

    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "USD";
    public PaymentStatus Status { get; private set; } = PaymentStatus.Pending;
    public PaymentMethod Method { get; private set; }
    public string? ExternalPaymentId { get; private set; }
    public string? FailureReason { get; private set; }

    public static Payment Create(Guid tenantId, Guid bookingId, decimal amount, PaymentMethod method, string currency = "USD")
    {
        if (amount <= 0) throw new ArgumentException("Payment amount must be positive.", nameof(amount));

        return new Payment
        {
            TenantId = tenantId,
            BookingId = bookingId,
            Amount = amount,
            Method = method,
            Currency = currency
        };
    }

    public void MarkSucceeded(string externalPaymentId)
    {
        Status = PaymentStatus.Succeeded;
        ExternalPaymentId = externalPaymentId;
        SetUpdatedAt();
        AddDomainEvent(new PaymentSucceededEvent(Id, TenantId, BookingId, Amount));
    }

    public void MarkFailed(string reason)
    {
        Status = PaymentStatus.Failed;
        FailureReason = reason;
        SetUpdatedAt();
    }

    public void Refund()
    {
        Status = PaymentStatus.Refunded;
        SetUpdatedAt();
        AddDomainEvent(new PaymentRefundedEvent(Id, TenantId, BookingId, Amount));
    }
}
