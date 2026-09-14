namespace Crm04.Domain.Configuration;

/// <summary>A scene-space vector. Serialised as a 3-element array to match the TypeScript tuple.</summary>
public readonly record struct Vec3(double X, double Y, double Z)
{
    public double[] ToArray() => [X, Y, Z];
}

/// <summary>
/// PLANT REFERENCE CONFIGURATION - §2 of the master spec.
/// CRM04 / CRM06 4HI reversing cold rolling mill, Tata Steel CRM Sahibabad, Narrow Complex.
///
/// Port of <c>src/config/millConfig.ts</c>. SINGLE SOURCE for every machine dimension, rating
/// and identity string. No component may hardcode a mill dimension.
///
/// This type is served verbatim by <c>GET /api/config/mill</c> and is what the browser-side
/// three.js module builds its geometry from, so it is simultaneously the physics reference,
/// the plant-config page's data and the 3D scene's dimensions - exactly the guarantee the
/// TypeScript object gives today.
///
/// PROVENANCE. Most machine data here comes from the OEM manual - Flat Products Equipments (I)
/// Ltd., CRM04 Operation and Maintenance Manual, reproduced in
/// <c>docs/CRM04_MECHANICAL_DATA_BOOK.md</c>. Parameters still marked unverified in
/// <c>PLANT_PARAMETERS</c> are PLACEHOLDERS, rendered with an UNVERIFIED badge everywhere they
/// appear. They must not be presented as mill technology data.
/// </summary>
public sealed record MillConfig(
    MillIdentity Identity,
    MillGeometry Geometry,
    MillLineLayout LineLayout,
    MillRatings Ratings,
    MillAgc Agc,
    MillReels Reels,
    MillPassSchedule PassSchedule,
    MillVisual Visual)
{
    /// <summary>
    /// The CRM04 configuration. Values are transcribed one-for-one from
    /// <c>src/config/millConfig.ts</c>; a golden test asserts the two agree.
    /// </summary>
    public static readonly MillConfig Default = new(
        Identity: new MillIdentity(
            Plant: "Tata Steel CRM Sahibabad — Narrow Complex",
            Mill: "CRM04",
            AlternateMill: "CRM06",
            Type: "4HI reversing, single stand",
            HmiReference: "ABB MillPilot",
            DriveSystem: "ABB MillPilotDrives / MillRollGap"),

        Geometry: new MillGeometry(
            WorkRollDiameter: 215d,
            WorkRollDiameterMin: 202d,
            WorkRollDiameterMax: 215d,
            WorkRollNeckDiameter: 120.65d,
            BackupRollDiameter: 550d,
            BackupRollDiameterMin: 520d,
            BackupRollDiameterMax: 550d,
            BackupRollNeckDiameter: 317.5d,
            BarrelLength: 600d,
            HousingWidth: 1600d,
            HousingHeight: 3500d,
            MandrelDiameter: 508d,
            TensionReelCollapsedDiameter: 497d,
            TensionReelFaceWidth: 620d,
            PorMandrelFaceWidth: 680d,
            PorMandrelExpandedDiameter: 530d,
            PorMandrelCollapsedDiameter: 460d,
            MaxCoilDiameter: 1900d,
            CoilInnerDiameter: 508d,
            PassLineHeight: 900d),

        LineLayout: new MillLineLayout(
            EntrySideSign: -1,
            AirKnifeDistance: 450d,
            GaugeDistance: 900d,
            DeflectorDistance: 1500d,
            CropShearDistance: 2400d,
            EtrDistance: 4200d,
            DtrDistance: 4200d,
            CarryOverTableDistance: 5600d,
            FlattenerDistance: 6700d,
            PeelerDistance: 7500d,
            PorDistance: 8600d,
            CoilCarTravel: 3400d,
            SaddleZ: -2200d),

        Ratings: new MillRatings(
            MaxRollingForce: 360d,
            MaxMillSpeed: 450d,
            BaseMillSpeed: 170d,
            ThreadingSpeed: 30d,
            MillModulus: 500d,
            MainDriveRating: 750d,
            MainDriveBaseRpm: 350d,
            MainDriveMaxRpm: 710d,
            MainDriveRatedTorque: 20.5d,
            MainDriveRatedCurrent: 1400d,
            ReelDriveRating: 500d,
            ReelDriveBaseRpm: 438d,
            ReelDriveMaxRpm: 1350d,
            ReelGearRatio: 4.3333d,
            ReelRatedTorque: 47d,
            ReelRatedCurrent: 1100d,
            PorDriveRating: 70d,
            PorGearRatio: 99.37d,
            MillPinionRatio: 1d,
            FlattenerReducerRatio: 20d,
            ReelTensionMaxKg: 6900d,
            ReelTensionMaxHighSpeedKg: 5300d,
            ReelTensionMinKg: 690d,
            PorTensionMaxKg: 2500d,
            RollForceCylinderBore: 420d,
            RollForceCylinderStroke: 45d,
            RollForceWorkingPressure: 210d,
            RollForceTestPressure: 250d,
            AuxCylinderWorkingPressure: 105d,
            AuxCylinderTestPressure: 160d,
            PorAxialShift: 75d,
            ThicknessToleranceUm: 5d,
            MaxStripWidth: 500d,
            MinStripWidth: 250d,
            EntryThicknessMin: 1.6d,
            EntryThicknessMax: 4.5d,
            ExitThicknessMin: 0.3d,
            ExitThicknessMax: 3.0d,
            CarbonMin: 0.05d,
            CarbonMax: 1.03d,
            MaxCoilWeightT: 10d,
            MaxCoilWeightPerMmKg: 20d,
            CoolantFlowLpm: 1200d,
            DriveLubeFlowLpm: 180d,
            FumeExhaustCapacity: 40_000d),

        Agc: new MillAgc(
            Type: "HAGC",
            ServoValveBandwidthHz: 100d,
            PositionFeedback: "LVDT per side (OS / DS)",
            ThicknessFeedback: "Entry + exit X-ray gauges",
            Law: "Gaugemeter h = S0 + F/M with mass-flow trim",
            DifferentialForceReference: -9d,
            DifferentialForceIssueOpen: true),

        Reels: new MillReels(
            Etr: new ReelDescriptor("ETR", "Entry tension reel", "ENTRY"),
            Dtr: new ReelDescriptor("DTR", "Delivery tension reel", "DELIVERY"),
            Por: new ReelDescriptor("POR", "Pay-off reel (line charge)", "ENTRY_UPSTREAM")),

        PassSchedule: new MillPassSchedule("ABP / plant pass schedule system"),

        Visual: new MillVisual(
            StripThicknessExaggeration: 30d,
            RollGapExaggeration: 30d,
            RollGapVisualOffset: 0.004d,
            DampingHalfLife: 0.12d,
            CameraSideZ: -1,
            CameraHome: new Vec3(4.5d, 5.0d, -13.5d),
            CameraTarget: new Vec3(-2.2d, 0.1d, 0d),
            CameraStand: new Vec3(1.1d, 0.6d, -2.9d),
            CameraStandTarget: new Vec3(0d, 0.05d, 0d),
            CameraEntry: new Vec3(-4.2d, 3.2d, -7.5d),
            CameraEntryTarget: new Vec3(-6.6d, 0d, 0d),
            CameraFov: 36d,
            CameraMinDistance: 1.2d,
            CameraMaxDistance: 40d));

    /// <summary>Coolant / rolling oil per mill (§2). Confirmed.</summary>
    public IReadOnlyDictionary<string, string> Media { get; init; } =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["CRM04"] = "Bamerol Aquarol 411B",
            ["CRM06"] = "Servosteeroll C105",
        };
}

public sealed record MillIdentity(
    string Plant,
    string Mill,
    string AlternateMill,
    string Type,
    string HmiReference,
    string DriveSystem);

/// <summary>
/// Geometry, mm - FPE O&amp;M manual §1.3 (rolls) and §7.1 (reel mandrels).
///
/// These drive both the physics (contact length, roll rpm) and the 3D scene, so changing one
/// here updates the model and the render together. CRM04 is a NARROW mill: 215 mm work rolls
/// on a 600 mm barrel.
/// </summary>
/// <param name="WorkRollDiameter">Working Ø max, §1.3. The mill runs the roll down to Min before scrapping.</param>
/// <param name="WorkRollNeckDiameter">Work roll neck Ø - Timken TQO cone bore, §10.4 item 19.</param>
/// <param name="BackupRollNeckDiameter">BUR neck Ø - Timken TQO cone bore, §10.4 item 20.</param>
/// <param name="HousingWidth">Housing window width, mm - scene only, NOT stated in the manual (§14 item 2).</param>
/// <param name="HousingHeight">Housing height, mm - scene only, NOT stated in the manual (§14 item 2).</param>
/// <param name="MandrelDiameter">Tension reel mandrel Ø, expanded / true circle, §7.1.</param>
/// <param name="PorMandrelExpandedDiameter">Pay-off reel mandrel Ø, expanded, §5.2. Its true circle is also 508.</param>
/// <param name="MaxCoilDiameter">Maximum coil outside diameter, mm - outgoing, §1.2.</param>
/// <param name="CoilInnerDiameter">Coil inside diameter, mm - §1.2, equal to the mandrel true circle.</param>
/// <param name="PassLineHeight">
/// Pass line height above floor, mm - scene only. The manual dimensions this on EU 01 1 A1 but
/// the scan is not legible (§14 item 2).
/// </param>
public sealed record MillGeometry(
    double WorkRollDiameter,
    double WorkRollDiameterMin,
    double WorkRollDiameterMax,
    double WorkRollNeckDiameter,
    double BackupRollDiameter,
    double BackupRollDiameterMin,
    double BackupRollDiameterMax,
    double BackupRollNeckDiameter,
    double BarrelLength,
    double HousingWidth,
    double HousingHeight,
    double MandrelDiameter,
    double TensionReelCollapsedDiameter,
    double TensionReelFaceWidth,
    double PorMandrelFaceWidth,
    double PorMandrelExpandedDiameter,
    double PorMandrelCollapsedDiameter,
    double MaxCoilDiameter,
    double CoilInnerDiameter,
    double PassLineHeight);

/// <summary>
/// LINE LAYOUT - distances from the mill centreline, mm.
///
/// The ORDER is confirmed by the manual §3:
/// POR -&gt; pinch roll/flattener -&gt; ETR -&gt; entry deflector -&gt; MILL -&gt; delivery deflector -&gt; DTR,
/// which puts the pay-off reel and the flattener OUTBOARD of the entry tension reel, on the
/// same side of the stand.
///
/// The MAGNITUDES are not confirmed. They are dimensioned on EU 01 1 A1 but the manual's own
/// §14 item 1 records that the scan is illegible, so every distance is a plausible
/// reconstruction carried as unverified. They must be measured off the original drawing before
/// any use beyond the picture.
/// </summary>
/// <param name="EntrySideSign">
/// Which side of the stand the entry equipment occupies, in scene X. -1 puts POR / flattener /
/// ETR at -X, which the default camera renders on screen-RIGHT - the manual's right-to-left
/// mill hand (§1.1).
/// </param>
public sealed record MillLineLayout(
    int EntrySideSign,
    double AirKnifeDistance,
    double GaugeDistance,
    double DeflectorDistance,
    double CropShearDistance,
    double EtrDistance,
    double DtrDistance,
    double CarryOverTableDistance,
    double FlattenerDistance,
    double PeelerDistance,
    double PorDistance,
    double CoilCarTravel,
    double SaddleZ);

/// <summary>Ratings and process capability - FPE O&amp;M manual §1 and §2 unless noted.</summary>
/// <param name="MaxRollingForce">Maximum roll separating force, t - §1.1.</param>
/// <param name="MaxMillSpeed">Maximum mill speed, m/min - §1.1 (0 - 170 - 450).</param>
/// <param name="BaseMillSpeed">Base (field-weakening knee) mill speed, m/min - §1.1.</param>
/// <param name="MillModulus">
/// Mill modulus M, t/mm - PLACEHOLDER, gaugemeter anchor (§8.1). The FPE manual does not state
/// it; it has to be measured on the stand.
/// </param>
/// <param name="MainDriveRatedTorque">
/// DERIVED and must stay that way: T_rated = P_rated / ω_base = 750 kW / 350 rpm = 20.5 kNm.
/// Changing the kW or the base rpm without recomputing the torque breaks the relation the
/// drive model depends on.
/// </param>
/// <param name="MainDriveRatedCurrent">PLACEHOLDER - the manual gives kW and rpm for every drive but no armature current.</param>
/// <param name="ReelRatedTorque">DERIVED: 500 kW / 438 rpm × 4.3333 = 47 kNm.</param>
/// <param name="ReelTensionMaxKg">
/// Reel tension envelope, kgf - §1.4. Converted to kN exactly once, in
/// <see cref="EngineeringConfig"/>, so there is a single conversion point.
/// </param>
public sealed record MillRatings(
    double MaxRollingForce,
    double MaxMillSpeed,
    double BaseMillSpeed,
    double ThreadingSpeed,
    double MillModulus,
    double MainDriveRating,
    double MainDriveBaseRpm,
    double MainDriveMaxRpm,
    double MainDriveRatedTorque,
    double MainDriveRatedCurrent,
    double ReelDriveRating,
    double ReelDriveBaseRpm,
    double ReelDriveMaxRpm,
    double ReelGearRatio,
    double ReelRatedTorque,
    double ReelRatedCurrent,
    double PorDriveRating,
    double PorGearRatio,
    double MillPinionRatio,
    double FlattenerReducerRatio,
    double ReelTensionMaxKg,
    double ReelTensionMaxHighSpeedKg,
    double ReelTensionMinKg,
    double PorTensionMaxKg,
    double RollForceCylinderBore,
    double RollForceCylinderStroke,
    double RollForceWorkingPressure,
    double RollForceTestPressure,
    double AuxCylinderWorkingPressure,
    double AuxCylinderTestPressure,
    double PorAxialShift,
    double ThicknessToleranceUm,
    double MaxStripWidth,
    double MinStripWidth,
    double EntryThicknessMin,
    double EntryThicknessMax,
    double ExitThicknessMin,
    double ExitThicknessMax,
    double CarbonMin,
    double CarbonMax,
    double MaxCoilWeightT,
    double MaxCoilWeightPerMmKg,
    double CoolantFlowLpm,
    double DriveLubeFlowLpm,
    double FumeExhaustCapacity);

/// <summary>Automatic gauge control - §2, confirmed.</summary>
/// <param name="DifferentialForceReference">
/// Standing plant issue (§2): Mill 4 BUR barrel taper (DS &gt; OS) compounded by a -9 t AGC
/// differential force reference. Carried in the data model from day one so the OS/DS split is
/// never retrofitted.
/// </param>
public sealed record MillAgc(
    string Type,
    double ServoValveBandwidthHz,
    string PositionFeedback,
    string ThicknessFeedback,
    string Law,
    double DifferentialForceReference,
    bool DifferentialForceIssueOpen);

/// <param name="Side">
/// The PHYSICAL station, not the process role. Which reel is paying off at any moment is
/// derived from rolling direction, never hardcoded (§1).
/// </param>
public sealed record ReelDescriptor(string Id, string Name, string Side);

public sealed record MillReels(ReelDescriptor Etr, ReelDescriptor Dtr, ReelDescriptor Por);

public sealed record MillPassSchedule(string Source);

/// <summary>
/// 3D scene presentation constants.
///
/// VISUAL EXAGGERATION NOTICE: a 2 mm strip between 215 mm rolls is ~1% of the roll diameter
/// and is invisible at engineering scale. The strip thickness and roll gap are therefore drawn
/// with a linear exaggeration factor. The NUMBERS shown are always true; only the pixels are
/// scaled, and the scene labels the factor so nobody misreads the picture. Nothing else in the
/// scene is scaled.
/// </summary>
/// <param name="DampingHalfLife">Interpolation half-life for scene damping, seconds (§10.4).</param>
/// <param name="CameraSideZ">
/// WHICH SIDE OF THE BARREL THE CAMERA STANDS ON, in scene Z. Not a taste decision: the entry
/// equipment is at -X, so a camera on +Z would render the line with the entry end on the LEFT
/// and the first pass running left to right. CRM04's mill hand is RIGHT TO LEFT (§1.1), so the
/// camera stands at -Z and the twin reads the way the mill does to someone on the floor.
/// Flipping the sign moves every preset and every scene label together.
/// </param>
public sealed record MillVisual(
    double StripThicknessExaggeration,
    double RollGapExaggeration,
    double RollGapVisualOffset,
    double DampingHalfLife,
    int CameraSideZ,
    Vec3 CameraHome,
    Vec3 CameraTarget,
    Vec3 CameraStand,
    Vec3 CameraStandTarget,
    Vec3 CameraEntry,
    Vec3 CameraEntryTarget,
    double CameraFov,
    double CameraMinDistance,
    double CameraMaxDistance);
