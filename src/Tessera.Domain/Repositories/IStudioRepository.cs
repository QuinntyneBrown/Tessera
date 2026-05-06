using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IStudioRepository : IRepository<Studio>
{
    Task<IEnumerable<Studio>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
