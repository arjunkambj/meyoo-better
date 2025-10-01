import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  Alert,
  TouchableOpacity,
} from "react-native";
import { Button, Card, Skeleton, Chip } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  type AgentThread,
  DEFAULT_THREAD_PAGE_SIZE,
  useAgent,
} from "@/hooks/useAgent";

export function AgentConversationsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    threads,
    isLoadingThreads,
    threadsStatus,
    loadMoreThreads,
    deleteThread,
  } = useAgent({});

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force refresh logic would go here
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleNewChat = useCallback(() => {
    router.push("/agent");
  }, [router]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      router.push(`/agent?threadId=${threadId}`);
    },
    [router]
  );

  const handleDeleteThread = useCallback(
    (thread: AgentThread) => {
      Alert.alert(
        "Delete Conversation",
        `Are you sure you want to delete "${thread.title || "this conversation"}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteThread(thread.threadId);
              } catch (error) {
                console.error("Failed to delete thread:", error);
              }
            },
          },
        ]
      );
    },
    [deleteThread]
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  const canLoadMore = threadsStatus === "CanLoadMore";
  const isLoadingMore = threadsStatus === "LoadingMore";

  if (isLoadingThreads && (!threads || threads.length === 0)) {
    return (
      <View className="flex-1 bg-background px-4 py-6">
        <View className="gap-4">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Conversations
            </Text>
            <Text className="text-sm text-default-500">
              Your chat history with Meyoo Agent
            </Text>
          </View>
          <View className="gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="px-4 py-3 gap-4">
          <View className="gap-2">
            <Text className="text-2xl font-bold text-foreground">
              Conversations
            </Text>
            <Text className="text-sm text-default-500">
              {threads?.length
                ? `${threads.length} conversation${threads.length === 1 ? "" : "s"}`
                : "Start a new chat with Meyoo Agent"}
            </Text>
          </View>

          {!threads || threads.length === 0 ? (
            <Card surfaceVariant="1" className="mt-4">
              <Card.Body className="items-center py-6">
                <View className="items-center gap-4">
                  <View className="h-16 w-16 rounded-full bg-primary-100 items-center justify-center">
                    <Ionicons
                      name="chatbubbles-outline"
                      size={32}
                      color="#6366f1"
                    />
                  </View>
                  <Card.Title>No conversations yet</Card.Title>
                  <Card.Description className="text-center px-4">
                    Start a conversation to get help with your Shopify data,
                    marketing campaigns, and more.
                  </Card.Description>
                  <Button variant="primary" onPress={handleNewChat}>
                    <Button.StartContent>
                      <Ionicons name="add" size={20} color="white" />
                    </Button.StartContent>
                    <Button.LabelContent>Start First Chat</Button.LabelContent>
                  </Button>
                </View>
              </Card.Body>
            </Card>
          ) : (
            <View className="gap-3">
              {threads.map((thread) => (
                <TouchableOpacity
                  key={thread.threadId}
                  onPress={() => handleSelectThread(thread.threadId)}
                  activeOpacity={0.7}
                >
                  <Card className="bg-default-200/50">
                    <Card.Body>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 gap-2">
                          <View className="flex-row items-center gap-2">
                            {thread.status === "archived" && (
                              <Chip
                                size="sm"
                                color="default"
                                className="rounded-full"
                              >
                                <Text className="text-[10px]">Archived</Text>
                              </Chip>
                            )}
                            <Text className="text-xs text-default-500">
                              {formatDate(thread.createdAt)}
                            </Text>
                          </View>
                          <Text className="text-base font-semibold text-foreground">
                            {thread.title || "Untitled Conversation"}
                          </Text>
                          {thread.summary && (
                            <Text
                              className="text-sm text-default-600"
                              numberOfLines={2}
                            >
                              {thread.summary}
                            </Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteThread(thread);
                          }}
                          className="p-2"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    </Card.Body>
                  </Card>
                </TouchableOpacity>
              ))}

              {canLoadMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => loadMoreThreads?.(DEFAULT_THREAD_PAGE_SIZE)}
                  className="mt-2"
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </Button>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
