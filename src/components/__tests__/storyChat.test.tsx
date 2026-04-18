import { describe, it, expect, vi } from "vitest";
import { render } from "../../test/utils/test-utils";
import React from "react";

// Mock stores needed by story-chat components
vi.mock("../../stores/cartStore", () => ({
  useCartStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        job: {
          id: "j1", name: "Test Job", status: "Draft",
          entities: [
            { entity_id: "e1", name: "John", phone_number: "+1", email: "john@test.com", is_owner: true },
            { entity_id: "e2", name: "Jane", phone_number: "+2", email: "jane@test.com", is_owner: false },
          ],
          stories: [],
          owner_entity: { entity_id: "e1", name: "John" },
        },
        currentJobId: "j1",
        addStory: vi.fn(), updateStory: vi.fn(), deleteStory: vi.fn(),
        addEntity: vi.fn(), updateEntity: vi.fn(),
      };
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn().mockReturnValue({}) }
  ),
}));

vi.mock("../../api/uploadsApi", () => ({
  uploadsApi: { getPresignedUrl: vi.fn(), uploadFile: vi.fn(), confirmUpload: vi.fn() },
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  ALLOWED_EXTENSIONS: { image: [".jpg", ".png"], audio: [".mp3"], video: [".mp4"] },
}));

vi.mock("../../api/metafinderApi", () => ({
  metafinderApi: { getOptions: vi.fn().mockResolvedValue({}) },
}));

vi.mock("../../hooks/useMetaFinder", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../hooks", () => ({
  useMetaFinderInit: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
  useMetaFinderOptions: vi.fn().mockReturnValue({ options: null, isLoading: false, error: null }),
  useMetaFinderStatus: vi.fn().mockReturnValue({ isLoading: false, isInitialized: true, error: null }),
}));

vi.mock("../../stores/metafinderStore", () => ({
  useMetaFinderStore: vi.fn((selector) => {
    const state = { isLoading: false, isInitialized: true, error: null, initialize: vi.fn(), getOptionsForEventType: vi.fn().mockReturnValue(null) };
    return selector ? selector(state) : state;
  }),
}));

const mockMessage = {
  story_type: "chat message" as const,
  chat_uid: "chat1",
  sender: "e1",
  text: "Hello world!",
  status: "sent" as const,
  forwarded: false,
  attachments: [],
  time: "2024-01-01T12:00:00Z",
};

const mockEntities = [
  { entity_id: "e1", name: "John", phone_number: "+1", email: "john@test.com", is_owner: true },
  { entity_id: "e2", name: "Jane", phone_number: "+2", email: "jane@test.com", is_owner: false },
];

describe("StoryChatMessage", () => {
  it("renders an outgoing message", async () => {
    const { StoryChatMessage } = await import("../story-chat/StoryChatMessage");
    const { container } = render(
      <StoryChatMessage
        message={mockMessage}
        messageIndex={0}
        isOutgoing={true}
        senderName="John"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });

  it("renders an incoming message", async () => {
    const { StoryChatMessage } = await import("../story-chat/StoryChatMessage");
    const { container } = render(
      <StoryChatMessage
        message={{ ...mockMessage, sender: "e2" }}
        messageIndex={1}
        isOutgoing={false}
        senderName="Jane"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("StoryChatInput", () => {
  it("renders with sender selected", async () => {
    const { StoryChatInput } = await import("../story-chat/StoryChatInput");
    const { container } = render(
      <StoryChatInput
        selectedSender={mockEntities[0] as any}
        availableEntities={mockEntities as any[]}
        newMessageText=""
        onSenderChange={vi.fn()}
        onMessageChange={vi.fn()}
        onSend={vi.fn()}
        onKeyDown={vi.fn()}
        getEntityDisplayName={(id: string) => id === "e1" ? "John" : "Jane"}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("StoryChatParticipants", () => {
  it("renders with participants", async () => {
    const { StoryChatParticipants } = await import("../story-chat/StoryChatParticipants");
    const { container } = render(
      <StoryChatParticipants
        participants={mockEntities as any[]}
        availableEntities={mockEntities as any[]}
        onAddParticipant={vi.fn()}
        onRemoveParticipant={vi.fn()}
        getEntityDisplayName={(id: string) => id === "e1" ? "John" : "Jane"}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("MessageEditDialog", () => {
  it("renders open", async () => {
    const { MessageEditDialog } = await import("../story-chat/MessageEditDialog");
    const { container } = render(
      <MessageEditDialog
        open={true}
        message={mockMessage}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});

describe("StoryChatEditor", () => {
  it("renders with initial data", async () => {
    const { StoryChatEditor } = await import("../story-chat/StoryChatEditor");
    const { container } = render(
      <StoryChatEditor
        chatUid="chat1"
        initialData={{ participants: ["e1", "e2"], messages: [mockMessage] }}
        onChange={vi.fn()}
      />
    );
    expect(container).toBeTruthy();
  });
});
