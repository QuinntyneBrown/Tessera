namespace Tessera.Application.Tenants.Dtos;

public record TenantDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    bool IsActive,
    DateTime CreatedAt);
