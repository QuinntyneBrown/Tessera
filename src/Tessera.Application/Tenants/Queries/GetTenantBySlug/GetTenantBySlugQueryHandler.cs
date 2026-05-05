using MediatR;
using Tessera.Application.Common.Exceptions;
using Tessera.Application.Tenants.Dtos;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Tenants.Queries.GetTenantBySlug;

public class GetTenantBySlugQueryHandler(ITenantRepository tenantRepository)
    : IRequestHandler<GetTenantBySlugQuery, TenantDto>
{
    public async Task<TenantDto> Handle(GetTenantBySlugQuery request, CancellationToken cancellationToken)
    {
        var tenant = await tenantRepository.GetBySlugAsync(request.Slug, cancellationToken)
            ?? throw new NotFoundException(nameof(Tessera.Domain.Entities.Tenant), request.Slug);

        return new TenantDto(tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.IsActive, tenant.CreatedAt);
    }
}
