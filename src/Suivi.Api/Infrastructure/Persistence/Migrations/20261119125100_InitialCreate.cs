using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Suivi.Api.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CompletedSessions",
                columns: table => new
                {
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GameId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SpaceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GameType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    GameTitle = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    FinalStatus = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    AttemptsUsed = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxAttempts = table.Column<int>(type: "INTEGER", nullable: false),
                    FinalScore = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    NextAvailableAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    GameContentSnapshot = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CompletedSessions", x => x.SessionId);
                });

            migrationBuilder.CreateTable(
                name: "IngestedEvents",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SchemaVersion = table.Column<int>(type: "INTEGER", nullable: false),
                    IngestedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    PayloadHash = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    FinalStatus = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IngestedEvents", x => x.EventId);
                });

            migrationBuilder.CreateTable(
                name: "RecordedAttempts",
                columns: table => new
                {
                    AttemptId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AttemptNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    SubmittedAnswer = table.Column<string>(type: "TEXT", nullable: false),
                    Correct = table.Column<bool>(type: "INTEGER", nullable: false),
                    Score = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    MaxScore = table.Column<decimal>(type: "TEXT", precision: 10, scale: 2, nullable: false),
                    SubmittedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecordedAttempts", x => x.AttemptId);
                    table.ForeignKey(
                        name: "FK_RecordedAttempts_CompletedSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "CompletedSessions",
                        principalColumn: "SessionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CompletedSessions_SpaceId_CompletedAt",
                table: "CompletedSessions",
                columns: new[] { "SpaceId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CompletedSessions_SpaceId_GameId_CompletedAt",
                table: "CompletedSessions",
                columns: new[] { "SpaceId", "GameId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_CompletedSessions_SpaceId_GameType_FinalStatus",
                table: "CompletedSessions",
                columns: new[] { "SpaceId", "GameType", "FinalStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_IngestedEvents_SessionId",
                table: "IngestedEvents",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_RecordedAttempts_SessionId_AttemptNumber",
                table: "RecordedAttempts",
                columns: new[] { "SessionId", "AttemptNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "IngestedEvents");

            migrationBuilder.DropTable(
                name: "RecordedAttempts");

            migrationBuilder.DropTable(
                name: "CompletedSessions");
        }
    }
}
