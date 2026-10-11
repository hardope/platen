"use client";

import CollaborativeRoom from "@/components/collaborators/CollaborativeRoom";

interface DocumentClientProps {
  roomId: string;
  roomMetadata: RoomMetadata; // Replace with the actual metadata type
  users: User[];
  currentUserType: UserType;
}

const DocumentClient: React.FC<DocumentClientProps> = ({
  roomId,
  roomMetadata,
  users,
  currentUserType,
}) => {
  return (
    <main className="flex h-screen w-full flex-col items-center overflow-hidden print:block print:h-auto print:overflow-visible">
      <CollaborativeRoom
        roomId={roomId}
        roomMetadata={roomMetadata}
        users={users}
        currentUserType={currentUserType}
      />
    </main>
  );
};

export default DocumentClient;
