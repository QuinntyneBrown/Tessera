using MediatR;
using Tessera.Application.Tenants.Dtos;

namespace Tessera.Application.Tenants.Commands.CreateTenant;

public record CreateTenantCommand(string Name, string Slug) : IRequest<TenantDto>;
