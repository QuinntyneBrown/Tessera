using MediatR;
using Tessera.Application.Studios.Dtos;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Studios.Commands.CreateStudio;

public class CreateStudioCommandHandler(IStudioRepository studioRepository, IUnitOfWork unitOfWork)
    : IRequestHandler<CreateStudioCommand, StudioDto>
{
    public async Task<StudioDto> Handle(CreateStudioCommand request, CancellationToken cancellationToken)
    {
        var studio = Studio.Create(request.TenantId, request.Name, request.Address, request.City);
        studioRepository.Add(studio);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new StudioDto(studio.Id, studio.TenantId, studio.Name, studio.Description,
            studio.Address, studio.City, studio.PhoneNumber, studio.Email, studio.IsActive, studio.CreatedAt);
    }
}
