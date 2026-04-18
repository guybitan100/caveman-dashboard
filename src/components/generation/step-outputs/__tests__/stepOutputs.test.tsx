import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "../../../../test/utils/test-utils";
import React from "react";

// Mock shared styled components used by all step outputs
vi.mock("../../shared/styledComponents", () => ({
  ActionButton: (props: any) => <button {...props}>{props.children}</button>,
  StyledSelect: (props: any) => <select {...props}>{props.children}</select>,
  EmptyState: ({ children }: any) => <div>{children}</div>,
  SectionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../../../utils/date", () => ({
  formatDate: vi.fn((d: string) => d),
  formatTimestamp: vi.fn((d: string) => d),
}));

const mockEntities = [
  {
    entity_id: "e1", name: "John Doe",
    characteristics: { age: 30, gender: "male" as const, occupation: "Engineer", personality_traits: ["introverted"], tech_savviness: 8, social_activity: 5, background: "Tech worker" },
    languages: [{ name: "English", is_native: true, proficiency: "native" }],
    phone_numbers: ["+1234567890"], emails: ["john@test.com"],
  },
  {
    entity_id: "e2", name: "Jane Smith",
    characteristics: { age: 28, gender: "female" as const, occupation: "Designer", personality_traits: ["creative"], tech_savviness: 6, social_activity: 8, background: "Artist" },
    languages: [{ name: "Spanish", is_native: true, proficiency: "native" }],
    phone_numbers: ["+0987654321"], emails: ["jane@test.com"],
  },
];

const mockStory = {
  original_description: "A love story between neighbors",
  expanded_narrative: "In the heart of the city, two neighbors discover a shared passion for music...",
  setting: "Urban apartment complex, 2024",
  key_themes: ["love", "music", "discovery"],
  generated_at: "2024-01-01T00:00:00Z",
};

const mockSocialGraph = {
  relationships: [
    {
      entity_id_1: "e1", entity_id_2: "e2", relationship_type: "friend" as const,
      strength: 0.8, description: "Close friends", is_bidirectional: true, communication_frequency: 7,
    },
    {
      entity_id_1: "e1", entity_id_2: "e2", relationship_type: "colleague" as const,
      strength: 0.5, description: "Work together", is_bidirectional: true, communication_frequency: 5,
    },
  ],
};

const mockTimeline = [
  {
    event_id: "ev1", timestamp: "2024-01-15T10:00:00Z", category: "communication" as const,
    involved_entities: ["e1", "e2"], primary_entity: "e1", description: "Phone call about meeting",
    location: "New York", metadata: { duration: 300 }, significance: 7,
  },
  {
    event_id: "ev2", timestamp: "2024-01-16T14:00:00Z", category: "meeting" as const,
    involved_entities: ["e1"], primary_entity: "e1", description: "Business lunch",
    location: "LA", coordinates: [34.0522, -118.2437] as [number, number], metadata: {}, significance: 5,
  },
  {
    event_id: "ev3", timestamp: "2024-01-17T09:00:00Z", category: "social" as const,
    involved_entities: ["e2"], primary_entity: "e2", description: "Social media post",
    metadata: { platform: "twitter" }, significance: 3,
  },
];

const mockPhones = [
  {
    entity_id: "e1", entity_name: "John Doe", device_type: "iphone" as const,
    phone_number: "+1234567890", email: "john@test.com",
    start_date: "2024-01-01", end_date: "2024-06-01",
  },
  {
    entity_id: "e2", entity_name: "Jane Smith", device_type: "android" as const,
    phone_number: "+0987654321", email: "jane@test.com",
  },
];

describe("EntitiesOutput", () => {
  it("renders entities list", async () => {
    const { EntitiesOutput } = await import("../EntitiesOutput");
    const { container } = render(
      <EntitiesOutput data={mockEntities} />
    );
    expect(container).toBeTruthy();
    expect(screen.getByText("John Doe")).toBeTruthy();
    expect(screen.getByText("Jane Smith")).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { EntitiesOutput } = await import("../EntitiesOutput");
    const { container } = render(
      <EntitiesOutput data={mockEntities} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders in editing mode", async () => {
    const { EntitiesOutput } = await import("../EntitiesOutput");
    const { container } = render(
      <EntitiesOutput data={mockEntities} isEditing={true} onEdit={vi.fn()} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders empty entities", async () => {
    const { EntitiesOutput } = await import("../EntitiesOutput");
    const { container } = render(<EntitiesOutput data={[]} />);
    expect(container).toBeTruthy();
  });
});

describe("StoryOutput", () => {
  it("renders story expansion", async () => {
    const { StoryOutput } = await import("../StoryOutput");
    const { container } = render(<StoryOutput data={mockStory} />);
    expect(container).toBeTruthy();
  });

  it("renders expanded with themes", async () => {
    const { StoryOutput } = await import("../StoryOutput");
    const { container } = render(
      <StoryOutput data={mockStory} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders in editing mode", async () => {
    const { StoryOutput } = await import("../StoryOutput");
    const { container } = render(
      <StoryOutput data={mockStory} isEditing={true} onEdit={vi.fn()} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("SocialGraphOutput", () => {
  it("renders social graph", async () => {
    const { SocialGraphOutput } = await import("../SocialGraphOutput");
    const { container } = render(
      <SocialGraphOutput data={mockSocialGraph} entities={mockEntities} />
    );
    expect(container).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { SocialGraphOutput } = await import("../SocialGraphOutput");
    const { container } = render(
      <SocialGraphOutput data={mockSocialGraph} entities={mockEntities} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders in editing mode", async () => {
    const { SocialGraphOutput } = await import("../SocialGraphOutput");
    const { container } = render(
      <SocialGraphOutput data={mockSocialGraph} entities={mockEntities} isEditing={true} onEdit={vi.fn()} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders empty graph", async () => {
    const { SocialGraphOutput } = await import("../SocialGraphOutput");
    const { container } = render(
      <SocialGraphOutput data={{ relationships: [] }} entities={mockEntities} />
    );
    expect(container).toBeTruthy();
  });
});

describe("TimelineOutput", () => {
  it("renders timeline events", async () => {
    const { TimelineOutput } = await import("../TimelineOutput");
    const { container } = render(
      <TimelineOutput data={mockTimeline} entities={mockEntities} />
    );
    expect(container).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { TimelineOutput } = await import("../TimelineOutput");
    const { container } = render(
      <TimelineOutput data={mockTimeline} entities={mockEntities} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders empty timeline", async () => {
    const { TimelineOutput } = await import("../TimelineOutput");
    const { container } = render(
      <TimelineOutput data={[]} entities={mockEntities} />
    );
    expect(container).toBeTruthy();
  });
});

describe("PhoneSelectionOutput", () => {
  it("renders phone selections", async () => {
    const { PhoneSelectionOutput } = await import("../PhoneSelectionOutput");
    const { container } = render(
      <PhoneSelectionOutput data={mockPhones} entities={mockEntities} />
    );
    expect(container).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { PhoneSelectionOutput } = await import("../PhoneSelectionOutput");
    const { container } = render(
      <PhoneSelectionOutput data={mockPhones} entities={mockEntities} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });

  it("renders with selection change handler", async () => {
    const { PhoneSelectionOutput } = await import("../PhoneSelectionOutput");
    const { container } = render(
      <PhoneSelectionOutput data={mockPhones} entities={mockEntities} isEditing={true} onSelectionChange={vi.fn()} isExpanded={true} onToggleExpand={vi.fn()} />
    );
    expect(container).toBeTruthy();
  });
});

describe("StoryGenerationOutput", () => {
  it("renders generation result", async () => {
    const { StoryGenerationOutput } = await import("../StoryGenerationOutput");
    const { container } = render(
      <StoryGenerationOutput
        data={{
          session_id: "sess1",
          phone_mappings: [],
          generation_jobs: [],
          total_stories_generated: 15,
          total_jobs_created: 3,
          ufdr_submissions: [
            { job_id: "j1", phone_entity_name: "John", success: true },
            { job_id: "j2", phone_entity_name: "Jane", success: false, error: "timeout" },
          ],
          all_jobs_submitted: false,
        }}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { StoryGenerationOutput } = await import("../StoryGenerationOutput");
    const { container } = render(
      <StoryGenerationOutput
        data={{
          session_id: "sess1",
          phone_mappings: [{
            phone: { entity_id: "e1", entity_name: "John", device_type: "iphone" },
            stories: [],
            event_to_story_map: {},
            referenced_entity_ids: ["e1", "e2"],
            story_type_counts: { "chat_message": 5, "call": 3 },
          }],
          generation_jobs: [{ job_id: "j1", tasks: [], context: {}, custom_events: [], stories: [], entities: [] }],
          total_stories_generated: 8,
          total_jobs_created: 1,
          ufdr_submissions: [],
          all_jobs_submitted: true,
        }}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("SubmitJobOutput", () => {
  it("renders submitted jobs", async () => {
    const { SubmitJobOutput } = await import("../SubmitJobOutput");
    const { container } = render(
      <SubmitJobOutput
        isSubmitted={true}
        submittedJobs={[
          { job_id: "j1", phone_entity_name: "John", status: "Generating", submitted_at: new Date("2024-01-01") },
          { job_id: "j2", phone_entity_name: "Jane", status: "Done", submitted_at: new Date("2024-01-01") },
        ]}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders not submitted state", async () => {
    const { SubmitJobOutput } = await import("../SubmitJobOutput");
    const { container } = render(
      <SubmitJobOutput isSubmitted={false} />
    );
    expect(container).toBeTruthy();
  });

  it("renders expanded", async () => {
    const { SubmitJobOutput } = await import("../SubmitJobOutput");
    const { container } = render(
      <SubmitJobOutput
        isSubmitted={true}
        submittedJobs={[{ job_id: "j1", phone_entity_name: "John", status: "Draft", submitted_at: new Date() }]}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});
