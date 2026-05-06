using Tessera.Domain.Common;

namespace Tessera.Domain.Events;

public record PaymentRefundedEvent(Guid PaymentId, Guid TenantId, Guid BookingId, decimal Amount) : IDomainEvent;
