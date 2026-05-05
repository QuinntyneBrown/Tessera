using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tessera.Domain.Entities;

namespace Tessera.Infrastructure.Persistence.Configurations;

public class StudioConfiguration : IEntityTypeConfiguration<Studio>
{
    public void Configure(EntityTypeBuilder<Studio> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).IsRequired().HasMaxLength(200);
        builder.Property(s => s.Address).IsRequired().HasMaxLength(500);
        builder.Property(s => s.City).IsRequired().HasMaxLength(100);
        builder.Property(s => s.PhoneNumber).HasMaxLength(50);
        builder.Property(s => s.Email).HasMaxLength(200);
        builder.HasMany(s => s.YogaClasses).WithOne(y => y.Studio).HasForeignKey(y => y.StudioId).OnDelete(DeleteBehavior.Cascade);
    }
}
