using MediatR;
using Tessera.Application.Studios.Dtos;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Studios.Queries.GetStudiosByTenant;

public class GetStudiosByTenantQueryHandler(IStudioRepository studioRepository)
    : IRequestHandler<GetStudiosByTenantQuery, IEnumerable<StudioDto>>
{
    public async Task<IEnumerable<StudioDto>> Handle(GetStudiosByTenantQuery request, CancellationToken cancellationToken)
    {
        var studios = await studioRepository.GetByTenantIdAsync(request.TenantId, cancellationToken);
        return studios.Select(s => new StudioDto(s.Id, s.TenantId, s.Name, s.Description,
            s.Address, s.City, s.PhoneNumber, s.Email, s.IsActive, s.CreatedAt));
    }
}
