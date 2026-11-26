# Application Navigation

Ganzo Video Converter uses a 3-stage vertical workflow (`Swiper`) with nested horizontal carousels for media selection and extraction action choices. Forward navigation is gated on completing the required selection in the current stage, and navigation is locked while an extraction job is running or cancelling.

## Navigation Overview Graph

```mermaid
flowchart TD
    M0["Stage 1: Media Selection"]

    subgraph S2["Stage 2: Choose Extraction"]
      A0["Extract audio to MP3"]
      A1["Extract frames to JPG"]
      A2["Change format / Add watermark / Replace audio (Unavailable)"]
    end

    subgraph S3["Stage 3: Configure and Run"]
      C0["Configure Audio and Run"]
      C1["Configure JPG Frames and Run"]
      C2["Configure Other and Run (Unavailable)"]
    end

    W0["Stage 4: Wait for Completion & Show Results"]

    M0 -->|"File chosen"| S2
    A0 -->|"Selected"| C0
    A1 -->|"Selected"| C1
    A2 -->|"Selected"| C2

    C0 -->|"Start extraction"| W0
    C1 -->|"Start extraction"| W0
    C2 -->|"Start extraction"| W0
```

## In Depth Navigation Graph

```mermaid
flowchart TD
    subgraph S1["Stage 1: Media"]
        M0["View 1: Select or Drop Media"]
        M1["View 2: Review Media Metadata"]
        M0 -->|"File dropped or chosen"| M1
        M1 -->|"Remove selection"| M0
    end

    subgraph S2["Stage 2: Choose Extraction"]
        A0["Extract audio to MP3"]
        A1["Extract frames to JPG"]
        A2["Change format / Add watermark / Replace audio (Unavailable)"]
    end

    subgraph S3["Stage 3: Configure and Run"]
        J_IDLE["Idle (Summary, JPG Settings if frames, Choose Output)"]
        J_RUN["Running (Progress)"]
        J_MODAL["Modal: Stop extraction?"]
        J_CANCELLING["Cancelling"]
        J_CANCELLED["Cancelled"]
        J_SUCCESS["Success (Reveal in File Manager)"]
        J_ERROR["Error"]

        J_IDLE -->|"Start extraction"| J_RUN
        J_RUN -->|"Cancel extraction"| J_MODAL
        J_MODAL -->|"Keep extracting"| J_RUN
        J_MODAL -->|"Stop extraction"| J_CANCELLING
        J_CANCELLING -->|"Aborted"| J_CANCELLED
        J_RUN -->|"Completed"| J_SUCCESS
        J_RUN -->|"Failed"| J_ERROR
        J_CANCELLED -->|"Start another extraction"| J_IDLE
        J_SUCCESS -->|"Start another extraction"| J_IDLE
        J_ERROR -->|"Try again"| J_IDLE
    end

    S1 -->|"Use this media / Continue to extraction"| S2
    S2 -->|"Previous"| S1
    S2 -->|"Continue to configure (action selected)"| S3
    S3 -->|"Previous (when Idle)"| S2
    J_ERROR -->|"Choose another media file"| S1
```

## Navigation Controls

- **Top step bar (`step-nav`)**: Allows jumping to any unlocked stage (Stage 2 requires media; Stage 3 requires media and an action; disabled while a job is running or cancelling).
- **Vertical stages**: Controlled via the step bar, stage navigation buttons, mousewheel, touch swipe, or `ArrowUp` / `ArrowDown` keys.
- **Horizontal carousels**: Within Stage 1 (2 views) and Stage 2 (5 action cards), controlled via Previous/Next buttons, touch swipe, or `ArrowLeft` / `ArrowRight` keys.
