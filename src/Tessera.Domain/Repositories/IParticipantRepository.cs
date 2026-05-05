using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IParticipantRepository : IRepository<Participant>
{
    Task<IEnumerable<Participant>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Participant?> GetByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default);
}
