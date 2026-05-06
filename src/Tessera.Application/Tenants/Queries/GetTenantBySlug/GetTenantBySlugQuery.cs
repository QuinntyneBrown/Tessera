using MediatR;
using Tessera.Application.Tenants.Dtos;

namespace Tessera.Application.Tenants.Queries.GetTenantBySlug;

public record GetTenantBySlugQuery(string Slug) : IRequest<TenantDto>;
