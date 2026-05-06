using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IYogaClassRepository : IRepository<YogaClass>
{
    Task<IEnumerable<YogaClass>> GetByStudioIdAsync(Guid studioId, CancellationToken cancellationToken = default);
    Task<IEnumerable<YogaClass>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
