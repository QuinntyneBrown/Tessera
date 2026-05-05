using Tessera.Domain.Common;

namespace Tessera.Domain.Entities;

public class Instructor : BaseEntity, ITenantEntity
{
    private Instructor() { }

    public Guid TenantId { get; private set; }
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;
    public string Email { get; private set; } = default!;
    public string? Bio { get; private set; }
    public string? ProfileImageUrl { get; private set; }
    public bool IsActive { get; private set; } = true;

    public string FullName => $"{FirstName} {LastName}";

    public ICollection<ClassSession> ClassSessions { get; private set; } = [];

    public static Instructor Create(Guid tenantId, string firstName, string lastName, string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(lastName);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        return new Instructor
        {
            TenantId = tenantId,
            FirstName = firstName,
            LastName = lastName,
            Email = email.ToLowerInvariant()
        };
    }

    public void Update(string firstName, string lastName, string? bio, string? profileImageUrl)
    {
        FirstName = firstName;
        LastName = lastName;
        Bio = bio;
        ProfileImageUrl = profileImageUrl;
        SetUpdatedAt();
    }
}
