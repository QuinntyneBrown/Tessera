using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IClassSessionRepository : IRepository<ClassSession>
{
    Task<IEnumerable<ClassSession>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<ClassSession>> GetUpcomingByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
