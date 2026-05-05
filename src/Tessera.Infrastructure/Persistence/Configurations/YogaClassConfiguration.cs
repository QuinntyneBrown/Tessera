using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Tessera.Domain.Entities;

namespace Tessera.Infrastructure.Persistence.Configurations;

public class YogaClassConfiguration : IEntityTypeConfiguration<YogaClass>
{
    public void Configure(EntityTypeBuilder<YogaClass> builder)
    {
        builder.HasKey(y => y.Id);
        builder.Property(y => y.Name).IsRequired().HasMaxLength(200);
        builder.Property(y => y.PricePerSession).HasPrecision(18, 2);
        builder.Property(y => y.Style).HasConversion<string>();
        builder.HasMany(y => y.Sessions).WithOne(s => s.YogaClass).HasForeignKey(s => s.YogaClassId).OnDelete(DeleteBehavior.Cascade);
    }
}
