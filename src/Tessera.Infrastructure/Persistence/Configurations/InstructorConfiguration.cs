using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tessera.Domain.Entities;

namespace Tessera.Infrastructure.Persistence.Configurations;

public class InstructorConfiguration : IEntityTypeConfiguration<Instructor>
{
    public void Configure(EntityTypeBuilder<Instructor> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.FirstName).IsRequired().HasMaxLength(100);
        builder.Property(i => i.LastName).IsRequired().HasMaxLength(100);
        builder.Property(i => i.Email).IsRequired().HasMaxLength(200);
        builder.HasIndex(i => new { i.TenantId, i.Email }).IsUnique();
        builder.Ignore(i => i.FullName);
    }
}
