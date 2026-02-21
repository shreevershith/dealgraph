"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { Competitor } from "@/lib/types";

// ── Fallback list when D3 graph fails ──

function CompetitorListFallback({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="space-y-1.5 p-4 overflow-auto">
      {competitors.map((c) => (
        <div
          key={c.name}
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ backgroundColor: "rgba(42, 42, 58, 0.3)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "#4ecdc4" }}
            />
            <span className="text-xs font-medium text-[var(--dg-text)]">
              {c.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--dg-dim)]">
            <span>{c.stage}</span>
            <span className="font-medium text-[var(--dg-text)]">
              {formatFunding(c.total_raised)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFunding(amount: number): string {
  if (amount >= 1_000_000_000) {
    const b = amount / 1_000_000_000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${Math.round(amount / 1_000_000)}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${amount}`;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  total_raised: number;
  stage: string;
  employee_count?: number;
  radius: number;
  isTarget: boolean;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: GraphNode | string;
  target: GraphNode | string;
}

// ── Pulsing triangle placeholder for loading ──

function GraphLoadingPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "#0a0a0f" }}>
      <div className="relative h-32 w-40">
        {/* Three pulsing circles in a triangle */}
        {[
          { cx: "50%", cy: "10%", delay: "0s", size: 28 },
          { cx: "15%", cy: "85%", delay: "0.4s", size: 22 },
          { cx: "85%", cy: "85%", delay: "0.8s", size: 18 },
        ].map((c, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              left: c.cx,
              top: c.cy,
              width: c.size,
              height: c.size,
              transform: "translate(-50%, -50%)",
              backgroundColor: i === 0 ? "rgba(108, 92, 231, 0.3)" : "rgba(78, 205, 196, 0.2)",
              boxShadow: i === 0
                ? "0 0 20px rgba(108, 92, 231, 0.2)"
                : "0 0 12px rgba(78, 205, 196, 0.15)",
              animation: `pulse 2s ease-in-out ${c.delay} infinite`,
            }}
          />
        ))}
        {/* Connecting lines */}
        <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.15 }}>
          <line x1="50%" y1="10%" x2="15%" y2="85%" stroke="#2a2a3a" strokeWidth="1" />
          <line x1="50%" y1="10%" x2="85%" y2="85%" stroke="#2a2a3a" strokeWidth="1" />
          <line x1="15%" y1="85%" x2="85%" y2="85%" stroke="#2a2a3a" strokeWidth="1" />
        </svg>
      </div>
      <p className="absolute bottom-6 text-xs text-[var(--dg-dim)]">
        Mapping competitive landscape...
      </p>
    </div>
  );
}

interface CompetitiveGraphProps {
  competitors?: Competitor[];
  loading?: boolean;
  targetCompany?: string;
}

export default function CompetitiveGraph({
  competitors,
  loading = false,
  targetCompany = "Acme Payments",
}: CompetitiveGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(
    null
  );
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: GraphNode;
  } | null>(null);
  const [graphError, setGraphError] = useState(false);

  const buildGraph = useCallback(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg || !competitors || competitors.length === 0) return;

    try {

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clean up previous
    if (simulationRef.current) {
      simulationRef.current.stop();
    }
    d3.select(svg).selectAll("*").remove();
    setTooltip(null);
    setGraphError(false);

    // Ensure the target company exists in the data
    const graphCompetitors = [...competitors];
    const hasTarget = graphCompetitors.some((c) => c.name === targetCompany);
    if (!hasTarget) {
      graphCompetitors.unshift({
        name: targetCompany,
        total_raised: 5_000_000,
        stage: "Series A",
        employee_count: 25,
      });
    }

    // Build radius scale - logarithmic
    const fundingValues = graphCompetitors.map((c) => c.total_raised);
    const radiusScale = d3
      .scaleLog()
      .domain([Math.min(...fundingValues), Math.max(...fundingValues)])
      .range([8, 45])
      .clamp(true);

    // Build nodes - start off-screen for fly-in effect
    const nodes: GraphNode[] = graphCompetitors.map((c, idx) => {
      const isTarget = c.name === targetCompany;
      const angle = (idx / graphCompetitors.length) * Math.PI * 2;
      return {
        id: c.name,
        name: c.name,
        total_raised: c.total_raised,
        stage: c.stage,
        employee_count: c.employee_count,
        radius: radiusScale(c.total_raised),
        isTarget,
        x: isTarget ? width / 2 : width / 2 + Math.cos(angle) * Math.max(width, height),
        y: isTarget ? height / 2 : height / 2 + Math.sin(angle) * Math.max(width, height),
      };
    });

    // Build links from target to every other node
    const links: GraphLink[] = graphCompetitors
      .filter((c) => c.name !== targetCompany)
      .map((c) => ({
        source: targetCompany,
        target: c.name,
      }));

    // D3 selection
    const svgSel = d3
      .select(svg)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Defs for glow filter + radial gradient background
    const defs = svgSel.append("defs");

    // Radial gradient - lighter at center, darker at edges
    const bgGrad = defs
      .append("radialGradient")
      .attr("id", "graph-bg-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%")
      .attr("r", "50%");
    bgGrad.append("stop").attr("offset", "0%").attr("stop-color", "#14141e");
    bgGrad.append("stop").attr("offset", "100%").attr("stop-color", "#0a0a0f");

    // Background rect with radial gradient
    svgSel
      .insert("rect", ":first-child")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#graph-bg-gradient)");

    const glowFilter = defs
      .append("filter")
      .attr("id", "target-glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");

    glowFilter
      .append("feGaussianBlur")
      .attr("stdDeviation", "6")
      .attr("result", "blur");

    glowFilter
      .append("feFlood")
      .attr("flood-color", "#6c5ce7")
      .attr("flood-opacity", "0.4")
      .attr("result", "color");

    glowFilter
      .append("feComposite")
      .attr("in", "color")
      .attr("in2", "blur")
      .attr("operator", "in")
      .attr("result", "glow");

    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "glow");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Container group
    const g = svgSel.append("g");

    // Links
    const linkSel = g
      .selectAll<SVGLineElement, GraphLink>("line")
      .data(links)
      .join("line")
      .attr("stroke", "#2a2a3a")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", 1);

    // Node groups
    const nodeSel = g
      .selectAll<SVGGElement, GraphNode>("g.node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Circles
    nodeSel
      .append("circle")
      .attr("r", 0)
      .attr("fill", (d) => (d.isTarget ? "#6c5ce7" : "rgba(78, 205, 196, 0.7)"))
      .attr("stroke", (d) =>
        d.isTarget ? "rgba(108, 92, 231, 0.6)" : "rgba(78, 205, 196, 0.3)"
      )
      .attr("stroke-width", (d) => (d.isTarget ? 2.5 : 1))
      .attr("filter", (d) => (d.isTarget ? "url(#target-glow)" : "none"))
      .transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .ease(d3.easeBackOut.overshoot(1.2))
      .attr("r", (d) => d.radius);

    // Label background pills + text
    const labelGroups = nodeSel.append("g").attr("class", "label-group");

    labelGroups
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d: GraphNode) => d.radius + 16)
      .attr("fill", (d: GraphNode) => (d.isTarget ? "#e4e4ef" : "#a0a0b8"))
      .attr("font-size", (d: GraphNode) => Math.max(9, Math.min(12, d.radius * 0.35)))
      .attr("font-weight", (d: GraphNode) => (d.isTarget ? "600" : "400"))
      .attr("font-family", "var(--font-dm-sans), system-ui, sans-serif")
      .text((d: GraphNode) => d.name);

    labelGroups
      .attr("opacity", 0)
      .transition()
      .delay(600)
      .duration(400)
      .attr("opacity", 1);

    // Funding labels inside larger nodes
    nodeSel
      .filter((d) => d.radius >= 20)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("fill", "rgba(255, 255, 255, 0.85)")
      .attr("font-size", (d) => Math.max(8, d.radius * 0.3))
      .attr("font-weight", "600")
      .attr("font-family", "var(--font-jetbrains-mono), monospace")
      .text((d) => formatFunding(d.total_raised))
      .attr("opacity", 0)
      .transition()
      .delay(800)
      .duration(400)
      .attr("opacity", 1);

    // Hover interactions
    nodeSel
      .on("mouseenter", function (event, d) {
        // Dim others
        nodeSel
          .transition()
          .duration(200)
          .style("opacity", (n) => (n.id === d.id ? 1 : 0.35));

        linkSel
          .transition()
          .duration(200)
          .attr("stroke-opacity", (l) => {
            const src = typeof l.source === "object" ? l.source.id : l.source;
            const tgt = typeof l.target === "object" ? l.target.id : l.target;
            return src === d.id || tgt === d.id ? 0.6 : 0.1;
          });

        // Brighten hovered circle
        d3.select(this)
          .select("circle")
          .transition()
          .duration(200)
          .attr("stroke-width", 3)
          .attr(
            "stroke",
            d.isTarget ? "rgba(108, 92, 231, 0.9)" : "rgba(78, 205, 196, 0.8)"
          );

        // Show tooltip
        const rect = container.getBoundingClientRect();
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          data: d,
        });
      })
      .on("mousemove", function (event) {
        const rect = container.getBoundingClientRect();
        setTooltip((prev) =>
          prev
            ? {
                ...prev,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              }
            : null
        );
      })
      .on("mouseleave", function (_, d) {
        nodeSel.transition().duration(300).style("opacity", 1);

        linkSel.transition().duration(300).attr("stroke-opacity", 0.4);

        d3.select(this)
          .select("circle")
          .transition()
          .duration(300)
          .attr("stroke-width", d.isTarget ? 2.5 : 1)
          .attr(
            "stroke",
            d.isTarget
              ? "rgba(108, 92, 231, 0.6)"
              : "rgba(78, 205, 196, 0.3)"
          );

        setTooltip(null);
      });

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const src = d.source as GraphNode;
            const tgt = d.target as GraphNode;
            return src.radius + tgt.radius + 60;
          })
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody().strength(-250))
      .force(
        "collision",
        d3.forceCollide<GraphNode>().radius((d) => d.radius + 6)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "x",
        d3.forceX<GraphNode>(width / 2).strength((d) => (d.isTarget ? 0.15 : 0.03))
      )
      .force(
        "y",
        d3.forceY<GraphNode>(height / 2).strength((d) => (d.isTarget ? 0.15 : 0.03))
      )
      .alpha(1)
      .alphaDecay(0.012)
      .on("tick", () => {
        // Clamp positions within bounds
        nodes.forEach((d) => {
          d.x = Math.max(d.radius + 4, Math.min(width - d.radius - 4, d.x!));
          d.y = Math.max(
            d.radius + 4,
            Math.min(height - d.radius - 20, d.y!)
          );
        });

        linkSel
          .attr("x1", (d) => (d.source as GraphNode).x!)
          .attr("y1", (d) => (d.source as GraphNode).y!)
          .attr("x2", (d) => (d.target as GraphNode).x!)
          .attr("y2", (d) => (d.target as GraphNode).y!);

        nodeSel.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
      });

    simulationRef.current = simulation;

    } catch (err) {
      console.error("[CompetitiveGraph] D3 rendering failed:", err);
      setGraphError(true);
    }
  }, [competitors, targetCompany]);

  useEffect(() => {
    buildGraph();

    const handleResize = () => buildGraph();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [buildGraph]);

  const hasCompetitors = competitors && competitors.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--dg-border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-[var(--dg-text)]">
            Competitive Landscape
          </h2>
        </div>
        {hasCompetitors && (
          <span className="text-xs text-[var(--dg-dim)]">
            {competitors.length} companies
          </span>
        )}
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ backgroundColor: "#0a0a0f" }}
      >
        {loading && !hasCompetitors && <GraphLoadingPlaceholder />}
        {graphError && hasCompetitors ? (
          <CompetitorListFallback competitors={competitors} />
        ) : (
          <svg ref={svgRef} className="h-full w-full" style={{ display: hasCompetitors ? "block" : "none" }} />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg px-3.5 py-2.5"
            style={{
              left: tooltip.x + 14,
              top: tooltip.y - 10,
              backgroundColor: "rgba(18, 18, 26, 0.95)",
              border: "1px solid var(--dg-border)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
              transform: "translateY(-50%)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: tooltip.data.isTarget
                    ? "#6c5ce7"
                    : "#4ecdc4",
                }}
              />
              <span className="text-sm font-semibold text-[var(--dg-text)]">
                {tooltip.data.name}
              </span>
            </div>
            <div className="mt-1.5 space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-6">
                <span className="text-[var(--dg-dim)]">Raised</span>
                <span className="font-medium text-[var(--dg-text)]">
                  {formatFunding(tooltip.data.total_raised)}
                </span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-[var(--dg-dim)]">Stage</span>
                <span className="text-[var(--dg-text)]">
                  {tooltip.data.stage}
                </span>
              </div>
              {tooltip.data.employee_count && (
                <div className="flex justify-between gap-6">
                  <span className="text-[var(--dg-dim)]">Employees</span>
                  <span className="text-[var(--dg-text)]">
                    {tooltip.data.employee_count.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
