using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class StudioRepository(TesseraDbContext context) : Repository<Studio>(context), IStudioRepository
{
    public async Task<IEnumerable<Studio>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.Studios.Where(s => s.TenantId == tenantId && s.IsActive).ToListAsync(cancellationToken);
}
