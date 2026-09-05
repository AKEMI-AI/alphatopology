"""AlphaTopology: deterministic Pydantic schemas for topology, signals, and agents.

Mirrors data/topology_schema.json (JSON Schema draft-07) — keep the two in sync.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Stage = Literal[
    "ENERGY_GRID",
    "EDA_IP",
    "RAW_MATERIALS_CHEMISTRY",
    "WFE_LITHOGRAPHY",
    "FOUNDRY",
    "MEMORY_HBM",
    "DICING_PACKAGING_SUBSTRATE",
    "INSPECTION_TESTING",
    "ODM_RACK_INTEGRATION",
    "COOLING_THERMAL",
    "OPTICAL_FABRIC",
    "HYPERSCALE_DEPLOYMENT",
    "FOUNDATION_MODELS",
    "ROBOTICS",
]

Basket = Literal["BK_CHOKE", "BK_FRONT", "BK_BACK", "BK_FABLESS", "BK_INFRA", "BK_MODELS"]

Criticality = Literal["CRITICAL", "HIGH", "MODERATE"]


class TopologyNode(BaseModel):
    id: str
    name: str
    ticker: str
    exchange: Optional[str] = None
    country: Optional[str] = None  # ISO 3166-1 alpha-2
    layer: int = Field(ge=1, le=5)
    stage: Stage
    chokepoint_rating: float = Field(ge=0.0, le=1.0)
    basket: Basket
    entity_type: Literal["PUBLIC", "PRIVATE"] = "PUBLIC"
    valuation_usd_b: Optional[float] = None  # private entities: last documented round


class TopologyEdge(BaseModel):
    source: str
    target: str
    relationship: str
    lead_time_days: int
    criticality: Criticality
    amount_usd_b: Optional[float] = None  # capital/compute commitments (money flow)


class SupplyChainTopology(BaseModel):
    nodes: List[TopologyNode]
    edges: List[TopologyEdge]


class MacroSignal(BaseModel):
    source_ticker: str
    target_ticker: str
    metric: str
    observed_delta: float
    confidence: float = Field(ge=0.0, le=1.0)
    transmission_lag_days: int
    signal_type: Literal["LONG", "SHORT", "PAIRS_SPREAD", "NEUTRAL"]
    rationale: str


class ValueChainNode(BaseModel):
    ticker: str
    basket: Basket
    chokepoint_score: float = Field(ge=0.0, le=1.0)
    current_pe_ratio: float
    forward_revenue_growth: float
