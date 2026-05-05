using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class InstructorRepository(TesseraDbContext context) : Repository<Instructor>(context), IInstructorRepository
{
    public async Task<IEnumerable<Instructor>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.Instructors.Where(i => i.TenantId == tenantId && i.IsActive).ToListAsync(cancellationToken);
}
