using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class TenantRepository(TesseraDbContext context) : Repository<Tenant>(context), ITenantRepository
{
    public async Task<Tenant?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
        => await Context.Tenants.FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken);

    public async Task<bool> SlugExistsAsync(string slug, CancellationToken cancellationToken = default)
        => await Context.Tenants.AnyAsync(t => t.Slug == slug, cancellationToken);
}
