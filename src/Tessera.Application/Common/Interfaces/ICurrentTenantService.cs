namespace Tessera.Application.Common.Interfaces;

public interface ICurrentTenantService
{
    Guid? TenantId { get; }
    string? TenantSlug { get; }
}
