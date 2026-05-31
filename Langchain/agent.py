from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from langchain.messages import AIMessage, HumanMessage
from deepagents.middleware import FilesystemMiddleware, MemoryMiddleware, SkillsMiddleware, SummarizationMiddleware, SubAgentMiddleware
from deepagents.backends import StateBackend
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware, PIIMiddleware, HumanInTheLoopMiddleware, wrap_model_call, ModelRequest, ModelResponse
from deepagents import SubAgent
from pydantic import BaseModel, Field
from typing import Literal, Callable



from dataclasses import dataclass

# Context schema defines the structure of the context that will be passed to the agent. The agent can 
# use this context to store and retrieve information across multiple invocations. In this example, we are storing the
# user_id in the context.

# Context passess per-run-data that the tools and middleware read at invocation time. 
# This is useful for storing information that is relevant to the current run of the agent, such as user preferences, session data, or 
# any other information that the agent might need to access while processing a request. 

# The context is passed to the tools and middleware at invocation time, allowing them to read and use this information as needed.

@dataclass
class Context:
    user_id: str

def get_weather(city: str) -> str:
    """Get the current weather for a given city."""
    # Docstring is required as it is used by the agent to understand how to use this tool.
    # This is a placeholder function. In a real implementation, you would call a weather API here.
    return f"The current weather in {city} is sunny with a temperature of 25°C."

llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key = ""
    )

# Pydantic is a data validation library that allows you to define data models with type annotations. 
# In this example, we are defining an Answer model that has a single field called "answer". This model 
# can be used to validate the output of the agent and ensure that it conforms to the expected structure.

class Answer(BaseModel):
    answer: str


agent = create_agent(
    model=llm,
    tools = [get_weather],
    context_schema = Context,
    system_prompt = "You are a helpful assistant that provides weather information based on the user's query.",
    checkpoint_saver = InMemorySaver(),
    middleware=[
        MemoryMiddleware(backend=StateBackend(), sources=["./AGENTS.md"]),
        SkillsMiddleware(backend=StateBackend(), sources=["./SKILLS.md"]),
        SubAgentMiddleware(subagents=[
            {
            "name":"research_agent",
            "tools":[get_weather],
            "system_prompt":"You are a research assistant."
        }]),
        PIIMiddleware(), # Guardrail to enforce certain PII policies on the agent's responses. 
                         # For example, you can use this middleware to redact sensitive information from the agent's responses or to prevent the agent from generating certain types of content.

        HumanInTheLoopMiddleware() # Steering that allows human to make decisions at certain points in the agent's execution. 
                                   # For example, you can use this middleware to ask the user for clarification 
    ],
    response_format=Answer # If BaseModel is used as output parser, we can reference the strcutured response like:
                           # result["structured_response"]

)

# This thread allows agent to persist state across multiple invocations. The agent will use the same thread_id to 
# store and retrieve its state.

config = {
    "configurable":{
        "thread_id": str(uuid7())
    }
}

result = agent.invoke(
    {
        "messages":
        [
            {"role": "user", 
            "content": "What is the weather like in New York?"}
        ]
    },
    config=config,
    context = Context(user_id="user_123")
)

for chunk in agent.stream(
    {
    "messages":
    [
        {"role": "user", 
         "content": "What is the meaning of life?"}
    ]},
    stream_mode = "values"):

    # Each chunk is a partial response from the agent. The agent will stream the response as it generates it.
    latest_message = chunk["messages"][-1]
    if latest_message.content:
        if isinstance(latest_message, AIMessage):
            print("AI:", latest_message.content)
        elif isinstance(latest_message, HumanMessage):
            print("Human:", latest_message.content)
    elif latest_message.tool_calls:
        print("Tool calls:", latest_message.tool_calls)



    print(result["messages"][-1].content_blocks)


# Models  

from langchain.tools import tool
from langchain.chat_models import init_chat_model

model = init_chat_model(
    model="gpt-4o-mini",
    model_provider="openai").bind(logprobs = True) # logprobs is a feature that allows you to get the log probabilities of the model's output tokens. 

@tool
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together."""
    return a + b

# For tools to be used by the model, they need to be bound, which i assumed is done internally, where
# the tool'name, description and argument definition are tranformed into a JSON schema? that the model 
# can use in subsequent invocations to understand how to call the tool. 

model_with_tools = model.bind_tools([add_numbers])

# Model is capable of reasoning by breaking down complex problems into smaller steps, and we can
# stream the model's resonning process. 
for chunk in model.stream("Why do parrots have colorful feathers?"):
    reasoning_steps = [r for r in chunk.content_blocks if r["type"] == "reasoning"]
    print(reasoning_steps if reasoning_steps else chunk.text)

# This decorator allows us to modifiy the model in request time, 
@wrap_model_call
def dyanmic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    """Choose a model based on conversation context and complexity."""
    message_count = len(request.messages)

    if message_count > 10:
        model = some_advanced_model # Placeholder for a more advanced model
    else:
        model = some_basic_model # Placeholder for a more basic model

    # Update the request with the chosen model
    return handler(request.override(model=model))


class WeatherInput(BaseModel):
    location: str = Field(..., description="The location to get the weather for")
    units: Literal["celsius", "fahrenheit"] = Field(
        default="celsius", description="The units for the weather information"
    )
    include_forecast: bool = Field(
        default=False, description="Whether to include a weather forecast in the response"
    )

@tool(args_schema=WeatherInput)
def get_weather(location:str, units:str = "celsius", include_forecast:bool = False) -> str:
    """Get the current weather for a given location."""
    # This is a placeholder function. In a real implementation, you would call a weather API here.
    forecast = " with a 20% chance of rain tomorrow." if include_forecast else "."
    temp_unit = "°C" if units == "celsius" else "°F"
    return f"The current weather in {location} is sunny with a temperature of 25{temp_unit}{forecast}"

# f is a prefix/f-string for formatting string literals such that the expression is evaluated at runtime and 

### Components

## State

from langchain.tools import tool, ToolRuntime 

@tool 
def get_last_user_message(runtime: ToolRuntime) -> str:
    """Get the most recent message from the user."""
    messages = runtime.state.get("messages", [])

    for message in reversed(messages):
        if isinstance(message, HumanMessage):
            return message.content
        
    return "No user messages found."

# Access custom state fields
@tool
def get_user_preference(pref: str, runtime: ToolRuntime) -> str:
    """Get user preference"""
    preference = runtime.state.get("user_preference", {})
    return preference.get(pref, "None")

## You can update an agent's state using the Command class /to update langgraph's state

from langchain.agents import AgentState
from langgraph.types import Command
from langchain.messages import ToolMessage

class CustomState(AgentState):
    user_name: str


# The command object here is a constructor for creating a command that updates the graph/ agent's state
# The tool message allows the model to see the results of the tool call 


# Generic type hint for static typing allows the IDEs to infer the the state define with state.user_name, 
# instead of state["user_name"]
@tool 
def set_user_name(name: str, runtime: ToolRuntime[None, CustomState]) -> Command:
    """Set the user's name in the conversation state."""
    return Command(
        update={
            "user_name": name,
            "messages":[
                ToolMessage(
                    content=f"User name set to {name}",
                    tool_call_id=runtime.tool_call_id
                )
            ],
        }
    )

## Context

user_database = {
    "user123":{
        "name": "Alice",
        "account_type": "saving"
    }
}

@dataclass
class UserContext:
    user_id : int


@tool 
def get_user_info(runtime: ToolRuntime[UserContext]) -> str:
    """Get current user info"""
    user_id = runtime.context.user_id

    if user_id in user_database:
        user = user_database[user_id]
        return(
            f"Holder: {user['name']}\n"
            f"Type: {user['account_type']}"
        )
    return "user :/"

# Then you'll basically pass this tool and context like the example we did above

## Store

from typing import Any
from langgraph.store.memory import InMemoryStore


# get is a method in the class 'store', that uses a tuple as the namespace, which is akin to a 
# hierachical path, like paths in filesystem, where store.get(("users",), user_id) ~ users/user_id
@tool 
def get_user_info(user_id: str, runtime:ToolRuntime) -> str:
    """Get current user info"""
    user_info = runtime.store.get(("users",), user_id)
    return str(user_info.value) if user_info else "?"


@tool
def update_user_info(user_id: str, user_info: dict[str, Any], runtime:ToolRuntime) -> str:
    """Update user info"""
    # This realistically means INSERT/UPDATE user_info under namespace "users" with key user_id
    runtime.store.put(("users,", user_id, user_info))
    return "ok"

store = InMemoryStore()

agent = create_agent(
    model,
    tools=[get_user_info, update_user_info],
    store=store
)

## Request and Response handler

# 'request' is a LLM execution rq object that contains some parameter like msg, tools and 'runtime', so 
# runtime is embedded/carried within the object

# handler is just a function reference to a Callable(a fucntion type that takes in some input and -> output),
# which takes a rq and return a rs, much like Express :
                                                        # (req, res, next) => {
                                                        #    next(req)
                                                        # }
# but in this case, its the next step executor, where it hands the modified request body downstream/foward
# we use override to create a copy of the request because its immutable, and is generally not safe to direct modify


@wrap_model_call
def store_based_tools(request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]) -> ModelResponse:
    """Filter tools based on Store preferences."""
    user_id = request.runtime.context.user_id

    # Read from Store: get user's enabled features
    store = request.runtime.store
    feature_flags = store.get(("features",), user_id)

    if feature_flags:
        enabled_features = feature_flags.value.get("enabled_tools", [])
        # Only include tools that are enabled for this user
        tools = [t for t in request.tools if t.name in enabled_features]
        request = request.override(tools=tools)

    return handler(request)