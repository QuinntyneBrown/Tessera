using Tessera.Domain.Common;

namespace Tessera.Domain.Events;

public record BookingConfirmedEvent(Guid BookingId, Guid TenantId, Guid ParticipantId) : IDomainEvent;
