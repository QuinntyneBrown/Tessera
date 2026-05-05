using Tessera.Domain.Common;

namespace Tessera.Domain.Events;

public record ClassSessionCancelledEvent(Guid SessionId, Guid TenantId) : IDomainEvent;
