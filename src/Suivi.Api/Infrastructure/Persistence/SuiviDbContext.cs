using Microsoft.EntityFrameworkCore;
using Suivi.Api.Domain.Model;

namespace Suivi.Api.Infrastructure.Persistence;

public class SuiviDbContext : DbContext
{
    public DbSet<CompletedGameSession> CompletedSessions => Set<CompletedGameSession>();
    public DbSet<RecordedAttempt> RecordedAttempts => Set<RecordedAttempt>();
    public DbSet<IngestedEvent> IngestedEvents => Set<IngestedEvent>();

    public SuiviDbContext(DbContextOptions<SuiviDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CompletedGameSession>(entity =>
        {
            entity.HasKey(e => e.SessionId);

            entity.Property(e => e.GameType)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(e => e.FinalStatus)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(e => e.GameTitle)
                .HasMaxLength(200);

            entity.Property(e => e.FinalScore)
                .HasPrecision(10, 2);

            entity.Property(e => e.FinalMaxScore)
                .HasPrecision(10, 2);

            entity.Property(e => e.GameContentSnapshot)
                .IsRequired();

            entity.HasIndex(e => new { e.SpaceId, e.CompletedAt })
                .HasDatabaseName("IX_CompletedSessions_SpaceId_CompletedAt");

            entity.HasIndex(e => new { e.SpaceId, e.GameId, e.CompletedAt })
                .HasDatabaseName("IX_CompletedSessions_SpaceId_GameId_CompletedAt");

            entity.HasIndex(e => new { e.SpaceId, e.GameType, e.FinalStatus })
                .HasDatabaseName("IX_CompletedSessions_SpaceId_GameType_FinalStatus");

            entity.HasMany(e => e.Attempts)
                .WithOne(a => a.Session)
                .HasForeignKey(a => a.SessionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RecordedAttempt>(entity =>
        {
            entity.HasKey(e => e.AttemptId);

            entity.Property(e => e.Score)
                .HasPrecision(10, 2);

            entity.Property(e => e.MaxScore)
                .HasPrecision(10, 2);

            entity.Property(e => e.SubmittedAnswer)
                .IsRequired();

            entity.HasIndex(e => new { e.SessionId, e.AttemptNumber })
                .IsUnique()
                .HasDatabaseName("IX_RecordedAttempts_SessionId_AttemptNumber");
        });

        modelBuilder.Entity<IngestedEvent>(entity =>
        {
            entity.HasKey(e => e.EventId);

            entity.Property(e => e.FinalStatus)
                .HasConversion<string>()
                .HasMaxLength(50);

            entity.Property(e => e.PayloadHash)
                .HasMaxLength(64);

            entity.HasIndex(e => e.SessionId)
                .HasDatabaseName("IX_IngestedEvents_SessionId");
        });
    }
}
