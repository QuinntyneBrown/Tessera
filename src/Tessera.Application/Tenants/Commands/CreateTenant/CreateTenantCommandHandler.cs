using MediatR;
using Tessera.Application.Tenants.Dtos;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Tenants.Commands.CreateTenant;

public class CreateTenantCommandHandler(ITenantRepository tenantRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateTenantCommand, TenantDto>
{
    public async Task<TenantDto> Handle(CreateTenantCommand request, CancellationToken cancellationToken)
    {
        if (await tenantRepository.SlugExistsAsync(request.Slug, cancellationToken))
            throw new InvalidOperationException($"Slug '{request.Slug}' is already taken.");

        var tenant = Tenant.Create(request.Name, request.Slug);
        tenantRepository.Add(tenant);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new TenantDto(tenant.Id, tenant.Name, tenant.Slug, tenant.LogoUrl, tenant.IsActive, tenant.CreatedAt);
    }
}
