using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IInstructorRepository : IRepository<Instructor>
{
    Task<IEnumerable<Instructor>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
}
