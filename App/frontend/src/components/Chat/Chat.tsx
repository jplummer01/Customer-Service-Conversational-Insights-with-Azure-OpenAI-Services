import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Textarea,
  Subtitle2,
  Subtitle1,
  Body1,
  Title3,
} from "@fluentui/react-components";
import "./Chat.css";
import { SparkleRegular } from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import supersub from "remark-supersub";
import { DefaultButton, Spinner, SpinnerSize } from "@fluentui/react";
import { useAppContext } from "../../state/useAppContext";
import { actionConstants } from "../../state/ActionConstants";
import {
  type ChartDataResponse,
  type Conversation,
  type ConversationRequest,
  type ParsedChunk,
  type ChatMessage,
  ToolMessageContent,
} from "../../types/AppTypes";
import { callConversationApi, historyUpdate } from "../../api/api";
import { ChatAdd24Regular } from "@fluentui/react-icons";
import { generateUUIDv4 } from "../../configs/Utils";
import ChatChart from "../ChatChart/ChatChart";
import { endianness } from "os";
import Citations from "../Citations/Citations";
import { json } from "d3";
// import Citations from "../Citations/Citations";

type ChatProps = {
  onHandlePanelStates: (name: string) => void;
  panels: Record<string, string>;
  panelShowStates: Record<string, boolean>;
};

const [ASSISTANT, TOOL, ERROR, USER] = ["assistant", "tool", "error", "user"];
const NO_CONTENT_ERROR = "No content in messages object.";

const Chat: React.FC<ChatProps> = ({
  onHandlePanelStates,
  panelShowStates,
  panels,
}) => {
  const { state, dispatch } = useAppContext();
  const { userMessage, generatingResponse } = state?.chat;
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const abortFuncs = useRef([] as AbortController[]);
  // const [lastRagResponse, setLastRagResponse] = useState<string | null>(null);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);

  const saveToDB = async (messages: ChatMessage[], convId: string) => {
    if (!convId || !messages.length) {
      return;
    }
    const isNewConversation = !state.selectedConversationId;
    dispatch({
      type: actionConstants.UPDATE_HISTORY_UPDATE_API_FLAG,
      payload: true,
    });
    await historyUpdate(messages, convId)
      .then(async (res) => {
        if (!res.ok) {
          if (!messages) {
            // setAnswers([...messages, errorChatMsg]);
            let err: Error = {
              ...new Error(),
              message: "Failure fetching current chat state.",
            };
            throw err;
          }
        }
        let responseJson = await res.json();
        if (isNewConversation && responseJson?.success) {
          const newConversation: Conversation = {
            id: responseJson?.data?.conversation_id,
            title: responseJson?.data?.title,
            messages: messages,
            date: responseJson?.data?.date,
            updatedAt: responseJson?.data?.date,
          };
          dispatch({
            type: actionConstants.ADD_NEW_CONVERSATION_TO_CHAT_HISTORY,
            payload: newConversation,
          });
          dispatch({
            type: actionConstants.UPDATE_SELECTED_CONV_ID,
            payload: responseJson?.data?.conversation_id,
          });
        }
        dispatch({
          type: actionConstants.UPDATE_HISTORY_UPDATE_API_FLAG,
          payload: false,
        });
        return res as Response;
      })
      .catch((err) => {
        console.error("Error: while saving data", err);
      })
      .finally(() => {
        dispatch({
          type: actionConstants.UPDATE_GENERATING_RESPONSE_FLAG,
          payload: false,
        });
        dispatch({
          type: actionConstants.UPDATE_HISTORY_UPDATE_API_FLAG,
          payload: false,
        });
      });
  };


  const parseCitationFromMessage = (message : any) => {
    console.log("parseCitationFromMessage", message);
    const dummyres = '\"citations\": [ {\"content\":\"Lost phone\",\"url\":\"https://google.com\",\"title\":\"\"}, {\"content\":\"Phone freezing\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Internet speed issues\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Activation delays\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Slow internet\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Network connectivity issues\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Poor network coverage\",\"url\":\"\",\"title\":\"\"}, {\"content\":\"Voicemail not working\",\"url\":\"\",\"title\":\"\"} ] }';
    // if (message.role === TOOL) {
    message =dummyres;
      try {
        message = '{'+ message 
        const toolMessage = JSON.parse(message as string) as ToolMessageContent;
        // console.log("toolMessage citations", toolMessage.citations);
        
        return toolMessage.citations;
      } catch {
        console.log("ERROR WHIEL PARSING TOOL CONTENT");
        // return [];
      }
    // }
    return [];
  };
  const isChartQuery = (query: string) => {
    const chartKeywords = ["chart", "graph", "visualize", "plot"];
    return chartKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );
  };

  useEffect(() => {
    if (state.chat.generatingResponse || state.chat.isStreamingInProgress) {
      const chatAPISignal = abortFuncs.current.shift();
      if (chatAPISignal) {
        console.log("chatAPISignal", chatAPISignal);
        chatAPISignal.abort(
          "Chat Aborted due to switch to other conversation while generating"
        );
      }
    }
  }, [state.selectedConversationId]);

  useEffect(() => {
    if (
      !state.chatHistory.isFetchingConvMessages &&
      chatMessageStreamEnd.current
    ) {
      setTimeout(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [state.chatHistory.isFetchingConvMessages]);

  const scrollChatToBottom = () => {
    if (chatMessageStreamEnd.current) {
      setTimeout(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [state.chat.generatingResponse]);

  const makeApiRequestWithCosmosDB = async (
    question: string,
    conversationId: string
  ) => {
    if (generatingResponse || !question.trim()) {
      return;
    }

    const newMessage: ChatMessage = {
      id: generateUUIDv4(),
      role: "user",
      content: question,
      date: new Date().toISOString(),
    };
    dispatch({
      type: actionConstants.UPDATE_GENERATING_RESPONSE_FLAG,
      payload: true,
    });
    scrollChatToBottom();
    dispatch({
      type: actionConstants.UPDATE_MESSAGES,
      payload: [newMessage],
    });
    dispatch({
      type: actionConstants.UPDATE_USER_MESSAGE,
      payload: "",
    });
    const abortController = new AbortController();
    abortFuncs.current.unshift(abortController);

    const request: ConversationRequest = {
      id: conversationId,
      messages: [...state.chat.messages, newMessage].filter(
        (messageObj) => messageObj.role !== ERROR
      ),
      last_rag_response:
        isChartQuery(userMessage) && state.chat.lastRagResponse
          ? JSON.stringify(state.chat.lastRagResponse)
          : null,
    };

    const streamMessage: ChatMessage = {
      id: generateUUIDv4(),
      date: new Date().toISOString(),
      role: ASSISTANT,
      content: "",
      citations:"",
    };
    let updatedMessages: ChatMessage[] = [];
    try {
      const response = await callConversationApi(
        request,
        abortController.signal
      );

      if (response?.body) {
        let isChartResponseReceived = false;
        const reader = response.body.getReader();
        let runningText = "";
        let hasError = false;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = new TextDecoder("utf-8").decode(value);
          // console.log("text::", text);
          try {
            const textObj = JSON.parse(text);
            // console.log("textObj::", textObj);
            if (textObj?.object?.data) {
              runningText = text;
              isChartResponseReceived = true;
            }
            if (textObj?.object?.message) {
              runningText = text;
              isChartResponseReceived = true;
            }
            if (textObj?.error) {
              hasError = true;
              runningText = text;
            }
          } catch (e) {
            console.error("error while parsing text before split", e);
          }
          if (!isChartResponseReceived) {
            //text based streaming response
            const objects = text.split("\n").filter((val) => val !== "");
            let answerText='';
            let citationString ='';
            objects.forEach((textValue, index) => {
              try {
                if (textValue !== "" && textValue !== "{}") {
                  // console.log("textValue::", textValue);
                  const parsed: ParsedChunk = JSON.parse(textValue);
                  // console.log("parsed res::", parsed);
                  if (parsed?.error && !hasError) {
                    hasError = true;
                    runningText = parsed?.error;
                  } else if (isChartQuery(userMessage)) {
                    runningText = runningText + textValue;
                  } else if (typeof parsed === "object" && !hasError) {
                    console.log(":::parsed::::",parsed);
                    const jsonString = parsed?.choices?.[0]?.messages?.[0]?.content;
                    const textStart = jsonString.indexOf(`"answer":`) +9; 
                 
                    const citationStart =  jsonString.indexOf(`"citations":`); 
                    if(citationStart > textStart){
                      answerText = jsonString.substring(textStart, citationStart).trim();
                      citationString = jsonString.substring(citationStart).trim();
                    }else{
                      answerText = jsonString.substring(textStart).trim();
                    }

                    // if(answerText.startsWith(`"`)){
                      answerText = answerText.replace(/^"+|"+$|,$/g, '');
                      answerText = answerText.replace(/[",]+$/, '');
                    // }
                    
                    
                    // const endIndex=
                    //   parsed?.choices?.[0]?.messages?.[0]?.content.indexOf(
                    //     `\", \"`
                    //   );
                    
                    // console.log(":::::index::", endIndex);
                    // const startIndex = parsed?.choices?.[0]?.messages?.[0]?.content.indexOf(
                    //   `{ \"answer\": \"`
                    // );
                    // const answerString =
                    // endIndex === -1?
                    //   parsed?.choices?.[0]?.messages?.[0]?.content.slice(startIndex +  `{ \"answer\": \"`.length):  parsed?.choices?.[0]?.messages?.[0]?.content.slice(startIndex +  `{ \"answer\": \"`.length, endIndex);
                    // console.log(":::::answerString::", answerString);
                    streamMessage.content = answerText || "";
                    streamMessage.role =
                      parsed?.choices?.[0]?.messages?.[0]?.role || ASSISTANT;


                    // const citationEndIndex = parsed?.choices?.[0]?.messages?.[0]?.content.indexOf(
                    //   `] }`
                    // );
                    streamMessage.citations = citationString;
                    dispatch({
                      type: actionConstants.UPDATE_MESSAGE_BY_ID,
                      payload: streamMessage,
                    });
                    scrollChatToBottom();
                  }
                }
              } catch (e) {
                console.log("Error while parsing and appending content", e);
              }
            });
            if (hasError) {
              console.log("STOPPED DUE TO ERROR FROM API RESPONSE");
              break;
            }
          }
        }
        // END OF STREAMING
        if (hasError) {
          const errorMsg = JSON.parse(runningText).error;
          const errorMessage: ChatMessage = {
            id: generateUUIDv4(),
            role: ASSISTANT,
            content: errorMsg,
            date: new Date().toISOString(),
          };
          updatedMessages = [...state.chat.messages, newMessage, errorMessage];
          dispatch({
            type: actionConstants.UPDATE_MESSAGES,
            payload: [errorMessage],
          });
          scrollChatToBottom();
        } else if (isChartQuery(userMessage)) {
          try {
            const parsedChartResponse = JSON.parse(runningText);
            if (
              "object" in parsedChartResponse &&
              parsedChartResponse?.object?.type &&
              parsedChartResponse?.object?.data
            ) {
              // CHART CHECKING
              try {
                const chartMessage: ChatMessage = {
                  id: generateUUIDv4(),
                  role: ASSISTANT,
                  content:
                    parsedChartResponse.object as unknown as ChartDataResponse,
                  date: new Date().toISOString(),
                };
                updatedMessages = [
                  ...state.chat.messages,
                  newMessage,
                  chartMessage,
                ];
                // Update messages with the response content
                dispatch({
                  type: actionConstants.UPDATE_MESSAGES,
                  payload: [chartMessage],
                });
                scrollChatToBottom();
              } catch (e) {
                console.error("Error handling assistant response:", e);
                const chartMessage: ChatMessage = {
                  id: generateUUIDv4(),
                  role: ASSISTANT,
                  content: "Error while generating Chart.",
                  date: new Date().toISOString(),
                };
                updatedMessages = [
                  ...state.chat.messages,
                  newMessage,
                  chartMessage,
                ];
                dispatch({
                  type: actionConstants.UPDATE_MESSAGES,
                  payload: [chartMessage],
                });
                scrollChatToBottom();
              }
            } else if (
              parsedChartResponse.error ||
              parsedChartResponse?.object?.message
            ) {
              const errorMsg =
                parsedChartResponse.error ||
                parsedChartResponse?.object?.message;
              const errorMessage: ChatMessage = {
                id: generateUUIDv4(),
                role: ASSISTANT,
                content: errorMsg,
                date: new Date().toISOString(),
              };
              updatedMessages = [
                ...state.chat.messages,
                newMessage,
                errorMessage,
              ];
              dispatch({
                type: actionConstants.UPDATE_MESSAGES,
                payload: [errorMessage],
              });
              scrollChatToBottom();
            }
          } catch (e) {
            console.log("Error while parsing charts response", e);
          }
        } else if (!isChartResponseReceived) {
          dispatch({
            type: actionConstants.SET_LAST_RAG_RESPONSE,
            payload: streamMessage?.content as string,
          });
          updatedMessages = [
            ...state.chat.messages,
            newMessage,
            ...[streamMessage],
          ];
        }
      }
      saveToDB(updatedMessages, conversationId);
    } catch (e) {
      console.log("Catched with an error while chat and save", e);
      if (abortController.signal.aborted) {
        if (streamMessage.content) {
          updatedMessages = [
            ...state.chat.messages,
            newMessage,
            ...[streamMessage],
          ];
        } else {
          updatedMessages = [...state.chat.messages, newMessage];
        }
        console.log(
          "@@@ Abort Signal detected: Formed updated msgs",
          updatedMessages
        );
        saveToDB(updatedMessages, conversationId);
      }

      if (!abortController.signal.aborted) {
        if (e instanceof Error) {
          alert(e.message);
        } else {
          alert(
            "An error occurred. Please try again. If the problem persists, please contact the site administrator."
          );
        }
      }
    } finally {
      dispatch({
        type: actionConstants.UPDATE_GENERATING_RESPONSE_FLAG,
        payload: false,
      });
      dispatch({
        type: actionConstants.UPDATE_STREAMING_FLAG,
        payload: false,
      });
    }
    return abortController.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const conversationId =
        state?.selectedConversationId || state.generatedConversationId;
      if (userMessage) {
        makeApiRequestWithCosmosDB(userMessage, conversationId);
      }
      if (questionInputRef?.current) {
        questionInputRef?.current.focus();
      }
    }
  };

  const onClickSend = () => {
    const conversationId =
      state?.selectedConversationId || state.generatedConversationId;
    if (userMessage) {
      makeApiRequestWithCosmosDB(userMessage, conversationId);
    }
    if (questionInputRef?.current) {
      questionInputRef?.current.focus();
    }
  };

  const setUserMessage = (value: string) => {
    dispatch({ type: actionConstants.UPDATE_USER_MESSAGE, payload: value });
  };

  const onNewConversation = () => {
    dispatch({ type: actionConstants.NEW_CONVERSATION_START });
  };
  const { messages, citations } = state.chat;
  useEffect(()=>{
    // console.log('messages::', messages)
    // console.log('citations::', citations)
  },[citations, messages]);
  return (
    <div className="chat-container">
      <div className="chat-header">
        <Subtitle2>Chat</Subtitle2>
        <span>
          <Button
            appearance="outline"
            onClick={() => onHandlePanelStates(panels.CHATHISTORY)}
            className="hide-chat-history"
          >
            {`${
              panelShowStates?.[panels.CHATHISTORY] ? "Hide" : "Show"
            } Chat History`}
          </Button>
        </span>
      </div>
      <div className="chat-messages">
        {Boolean(state.chatHistory?.isFetchingConvMessages) && (
          <div>
            <Spinner
              size={SpinnerSize.small}
              aria-label="Fetching Chat messages"
            />
          </div>
        )}
        {!Boolean(state.chatHistory?.isFetchingConvMessages) &&
          messages.length === 0 && (
            <div className="initial-msg">
              {/* <SparkleRegular fontSize={32} /> */}
              <h2>✨</h2>
              <Subtitle2>Start Chatting</Subtitle2>
              <Body1 style={{ textAlign: "center" }}>
                You can ask questions around customers calls, call topics and
                call sentiments.
              </Body1>
            </div>
          )}
        {!Boolean(state.chatHistory?.isFetchingConvMessages) &&
          messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              {(() => {
                if (msg.role === "user" && typeof msg.content === "string") {
                  return (
                    <div className="user-message">
                      <span>{msg.content}</span>
                    </div>
                  );
                }
                msg.content = msg.content as ChartDataResponse;
                if (msg?.content?.type && msg?.content?.data) {
                  return (
                    <div className="assistant-message chart-message">
                      <ChatChart chartContent={msg.content} />
                      <div className="answerDisclaimerContainer">
                        <span className="answerDisclaimer">
                          AI-generated content may be incorrect
                        </span>
                      </div>
                    </div>
                  );
                }
                if (typeof msg.content === "string") {
                  // console.log("mesg.conent:::", msg)
                  return (
                    <div className="assistant-message">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, supersub]}
                        children={msg.content}
                      />
                      <Citations
                      answer={{
                        answer: msg.content,
                        citations:
                          msg.role === ASSISTANT
                            ? parseCitationFromMessage(msg.citations)
                            : [],
                      }} 
                      index={index}
                      />

                      <div className="answerDisclaimerContainer">
                        <span className="answerDisclaimer">
                          AI-generated content may be incorrect
                        </span>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          ))}
        {generatingResponse && !state.chat.isStreamingInProgress && (
          <div className="assistant-message loading-indicator">
            <div className="typing-indicator">
              <span className="generating-text">Generating answer</span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div data-testid="streamendref-id" ref={chatMessageStreamEnd} />
      </div>
      <div className="chat-footer">
        <Button
          className="btn-create-conv"
          shape="circular"
          appearance="primary"
          icon={<ChatAdd24Regular />}
          onClick={onNewConversation}
          title="Create new Conversation"
          disabled={
            generatingResponse || state.chatHistory.isHistoryUpdateAPIPending
          }
        />
        <div className="text-area-container">
          <Textarea
            className="textarea-field"
            value={userMessage}
            onChange={(e, data) => setUserMessage(data.value || "")}
            placeholder="Ask a question..."
            onKeyDown={handleKeyDown}
            ref={questionInputRef}
            rows={2}
            style={{ resize: "none" }}
            appearance="outline"
          />
          <DefaultButton
            iconProps={{ iconName: "Send" }}
            role="button"
            onClick={onClickSend}
            disabled={
              generatingResponse ||
              !userMessage.trim() ||
              state.chatHistory.isHistoryUpdateAPIPending
            }
            className="send-button"
            aria-disabled={
              generatingResponse ||
              !userMessage ||
              state.chatHistory.isHistoryUpdateAPIPending
            }
            title="Send Question"
          />
        </div>
      </div>
    </div>
  );
};

export default Chat;
