# LangChain Chain Types Tutorial (Traditional Approach - No LCEL)
# This tutorial demonstrates Simple Chain, Sequential Chain, and Simple Sequential Chain


import os

# MODELS
from langchain_openai import ChatOpenAI
#from langchain_google_genai import ChatGoogleGenAI
#from langchain_anthropic import ChatAnthropic
#from langchain_huggingface import ChatHuggingFace

from langchain_classic.prompts import PromptTemplate

from langchain_classic.chains import LLMChain, SequentialChain, SimpleSequentialChain

from langchain_classic.schema import BaseOutputParser, StrOutputParser, JSONOutputParser, DictOutputParser


# LLM --> Output Parser ()

from dotenv import load_dotenv

load_dotenv()

# Set your OpenAI API key
os.environ["OPENAI_API_KEY"] 

# Initialize the LLM
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0.7,
    max_tokens=500, 
)



print("🚀 LangChain Chain Types Tutorial (Traditional Approach)")
print("=" * 60)

# ============================================================================
# 1. SIMPLE CHAIN (LLMChain - Single Input/Output)
# ============================================================================

print("\n1️⃣ SIMPLE CHAIN (LLMChain)")
print("-" * 30)

# Create a prompt template for generating a story
story_prompt = PromptTemplate(
    input_variables=["topic"],
    template="Write a short creative story (2-3 sentences) about {topic}. Make it interesting and engaging."
)

# Create a simple LLMChain
simple_chain = LLMChain(
    llm=llm,
    prompt=story_prompt,  
    output_key="text",  # Named output key for clarity
    output_parser=StrOutputParser()  # Optional: parse output as string (default behavior
)

# Execute the simple chain
topic = "a robot learning to paint"
story_result = simple_chain.run(topic=topic)  # Using .run() for single input
print(f"Topic: {topic}")
print(f"Generated Story: {story_result}")

# Alternative way to execute
story_result2 = simple_chain.invoke({"topic": "a cat who became a detective"})
print(f"\nAlternative execution: {story_result2['text']}")

# ============================================================================
# 2. SIMPLE SEQUENTIAL CHAIN (Output of Chain 1 → Input of Chain 2)
# ============================================================================
print("\n2️⃣ SIMPLE SEQUENTIAL CHAIN")
print("-" * 30)

# Chain 1: Generate a business idea
idea_prompt = PromptTemplate(
    input_variables=["industry"], #user input
    template="""Generate a creative business idea for the industry: {industry}. 
    Provide just the business idea in one sentence."""
)

idea_chain = LLMChain(
    llm=llm,
    prompt=idea_prompt,
    output_key="business_idea"  # Named output key
)

# Chain 2: Create a marketing slogan for the business idea
slogan_prompt = PromptTemplate(
    input_variables=["business_idea"],
    template="""Create a catchy marketing slogan for this business idea: {business_idea}. 
    Make it memorable and under 10 words."""
)

slogan_chain = LLMChain(
    llm=llm,
    prompt=slogan_prompt,
    output_key="marketing_slogan"  # Named output key
)

# Create Simple Sequential Chain
# Note: SimpleSequentialChain only handles single input/output between chains
simple_sequential_chain = SimpleSequentialChain(
    chains=[idea_chain, slogan_chain],
)

# Execute the chain
industry = "sustainable technology"
final_result = simple_sequential_chain.run(industry)  # Single input with .run()
print(f"Industry: {industry}")
print(f"Final Marketing Slogan: {final_result}")

# ============================================================================
# 3. SEQUENTIAL CHAIN (Multiple Inputs/Outputs with Named Variables)
# ============================================================================
print("\n3️⃣ SEQUENTIAL CHAIN")
print("-" * 20)

# Chain 1: Analyze a product concept
analysis_prompt = PromptTemplate(
    input_variables=["product_name", "target_market"], #user gives us that
    template="""Analyze this product concept:
    Product: {product_name}
    Target Market: {target_market}
    
    Provide a brief market analysis (2-3 sentences)."""
)

analysis_chain = LLMChain(
    llm=llm,
    prompt=analysis_prompt,
    output_key="market_analysis"  # Named output key
)

# Chain 2: Generate pricing strategy
pricing_prompt = PromptTemplate(
    input_variables=["product_name", "market_analysis"],
    template="""Based on this market analysis: {market_analysis}
    
    Suggest a pricing strategy for {product_name}.
    Include price range and reasoning (2-3 sentences)."""
)

pricing_chain = LLMChain(
    llm=llm,
    prompt=pricing_prompt,
    output_key="pricing_strategy"  # Named output key
)

# Chain 3: Create final business plan summary
business_plan_prompt = PromptTemplate(
    input_variables=["product_name", "target_market", "market_analysis", "pricing_strategy"],
    template="""Create a concise business plan summary using:
    
    Product: {product_name}
    Target Market: {target_market}
    Market Analysis: {market_analysis}
    Pricing Strategy: {pricing_strategy}
    
    Summarize in 3-4 sentences focusing on key opportunities."""
)

business_plan_chain = LLMChain(
    llm=llm,
    prompt=business_plan_prompt,
    output_key="business_plan"  # Named output key
)

# Create Sequential Chain with multiple named inputs/outputs
sequential_chain = SequentialChain(
    chains=[analysis_chain, pricing_chain, business_plan_chain],
    input_variables=["product_name", "target_market"],  # Initial inputs
    output_variables=["market_analysis", "pricing_strategy", "business_plan"],  # All outputs we want
)

# Execute the sequential chain
inputs = {
    "product_name": "Smart Fitness Mirror",
    "target_market": "health-conscious millennials"
}

sequential_result = sequential_chain.invoke(inputs)  # Using .invoke() for multiple inputs

print("📊 SEQUENTIAL CHAIN RESULTS:")
print(f"Product: {inputs['product_name']}")
print(f"Target Market: {inputs['target_market']}")
print(f"\n📈 Market Analysis:\n{sequential_result['market_analysis']}")
print(f"\n💰 Pricing Strategy:\n{sequential_result['pricing_strategy']}")
print(f"\n📋 Business Plan:\n{sequential_result['business_plan']}")

# ============================================================================
# ADVANCED EXAMPLE: Custom Output Parser
# ============================================================================
print("\n🔧 ADVANCED: Custom Output Parser")
print("-" * 35)

class ListOutputParser(BaseOutputParser):
    """Custom parser to extract list items from LLM output."""
    
    def parse(self, text: str):
        """Parse the output into a list."""
        lines = text.strip().split('\n')
        return [line.strip('- ').strip() for line in lines if line.strip()]

# Chain with custom parser
list_prompt = PromptTemplate(
    input_variables=["topic", "count"],
    template="Generate {count} creative ideas for {topic}. Format as a bullet list with - in front of each item."
)

list_chain = LLMChain(
    llm=llm,
    prompt=list_prompt,
    output_parser=ListOutputParser()  # Custom parser
)

ideas = list_chain.run(topic="team building activities", count="5")
print("Generated Ideas:")
for i, idea in enumerate(ideas, 1):
    print(f"{i}. {idea}")


# ============================================================================
# SUMMARY OF DIFFERENCES
# ============================================================================
print("\n" + "=" * 60)
print("📚 SUMMARY OF TRADITIONAL CHAIN TYPES")
print("=" * 60)

print("""
1️⃣ SIMPLE CHAIN (LLMChain):
   • Structure: LLMChain(llm, prompt, output_parser)
   • Single prompt template + LLM
   • Execute with: .run(), .invoke(), .apply()
   • Best for: Individual tasks

2️⃣ SIMPLE SEQUENTIAL CHAIN:
   • Structure: SimpleSequentialChain([chain1, chain2, ...])
   • Output of Chain 1 → Input of Chain 2
   • Single string input/output between chains
   • Execute with: .run() for single input
   • Best for: Linear workflows with simple data flow

3️⃣ SEQUENTIAL CHAIN:
   • Structure: SequentialChain(chains, input_variables, output_variables)
   • Multiple named inputs/outputs
   • Complex data flow between chains
   • Execute with: .invoke() for multiple inputs
   • Best for: Complex multi-step processes

KEY DIFFERENCES FROM LCEL:
• No | (pipe) operator
• Explicit LLMChain construction
• Traditional .run(), .invoke(), .apply() methods
• More verbose but clearer separation of concerns
""")

