using MediatR;
using Tessera.Application.Studios.Dtos;

namespace Tessera.Application.Studios.Commands.CreateStudio;

public record CreateStudioCommand(
    Guid TenantId,
    string Name,
    string? Description,
    string Address,
    string City,
    string? PhoneNumber,
    string? Email) : IRequest<StudioDto>;
