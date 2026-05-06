using MediatR;
using Tessera.Application.Studios.Dtos;

namespace Tessera.Application.Studios.Queries.GetStudiosByTenant;

public record GetStudiosByTenantQuery(Guid TenantId) : IRequest<IEnumerable<StudioDto>>;
