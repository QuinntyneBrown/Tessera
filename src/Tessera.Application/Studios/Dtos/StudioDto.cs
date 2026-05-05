namespace Tessera.Application.Studios.Dtos;

public record StudioDto(
    Guid Id,
    Guid TenantId,
    string Name,
    string? Description,
    string Address,
    string City,
    string? PhoneNumber,
    string? Email,
    bool IsActive,
    DateTime CreatedAt);
