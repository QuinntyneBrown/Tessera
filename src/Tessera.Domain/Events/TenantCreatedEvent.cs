using Tessera.Domain.Common;

namespace Tessera.Domain.Events;

public record TenantCreatedEvent(Guid TenantId) : IDomainEvent;
